// Moonrise service worker: makes the app open with no signal after one online visit.
//
// WHAT IS CACHED (positive list only):
//   - The core "shell" of the current build: the start page and same-origin static
//     references (Vite's hashed JS/CSS, manifest, icon), plus the single piano recording.
//   - Files under the build's assets/ folder that are only reached from JS/CSS (e.g. lazy
//     chunks), and only for script/style/image/font requests.
//   - Für Elise is cached in full with the core shell. The ten extra licensed
//     recordings download independently after activation; their failures never
//     hold up installation. Only complete validated files enter the audio cache.
//     Other audio, including all remote music, is never intercepted or cached.
// NEVER CACHED: fetch()/XHR requests (API calls, same-origin or not), cross-origin requests,
// non-GET requests, and anything outside the app's scope. fetch()/XHR requests are not
// intercepted at all.
//
// HOW A BUILD'S SHELL IS SAVED (commit protocol):
//   1. Fetch the start page. The shell cache is named after a hash of its HTML, so every
//      Vite build (new hashed file names -> new HTML) gets its own cache.
//   2. Download the HTML, core assets, and piano into that cache (not extra audio).
//   3. Check every file is really there.
//   4. Only then write the "committed shell" pointer (in moonrise-meta). This is the LAST write.
//   5. Delete the other shell caches.
// Pages are only ever served from the committed shell. A half-downloaded build (network drop,
// failed write, worker stopped mid-way) is never used and is rebuilt from scratch next time.
// Shell builds run one at a time.
//
// UPDATES:
//   - Start page: network first (4 s timeout); the committed shell's copy when offline.
//   - A new build replaces the committed shell only after it is complete (steps 1-5).
//   - Worker logic changes (bump SW_VERSION): the new worker's install must commit a complete
//     shell first. If it can't (e.g. offline), install fails, the browser keeps the old worker,
//     and the old committed shell is untouched. Old caches are removed only on activate,
//     which only happens after a successful install.
//   - No committed shell (first visit was offline, or site data was cleared): the start page
//     is a short "connect once" page (HTTP 503) instead of a browser error.

const SW_VERSION = 'v6'
// Exact approved stems; new downloads also require a current HTML-declared URL.
const BUNDLED_AUDIO_FILES = [
  'fur-elise-v-gao',
  'gymnopedie-1-macleod', 'let-me-call-you-sweetheart-1911', 'shine-on-harvest-moon-1909',
  'clair-de-lune-goedhart', 'canon-in-d-macleod', 'greensleeves-leckschat',
  'moonlight-sonata-suarez', 'bach-prelude-fugue-c-musopen',
  'traumerei-musopen', 'ave-maria-fayne-streibel',
]
const SHELL_PREFIX = 'moonrise-shell-' // not versioned: a committed shell survives worker updates
const META_CACHE = 'moonrise-meta'
const RUNTIME_CACHE = `moonrise-assets-${SW_VERSION}`
const AUDIO_CACHE = 'moonrise-audio-v1' // immutable hashed files survive worker/build updates
const CORE_AUDIO_STEM = 'fur-elise-v-gao'
const SHELL_PROTOCOL = 'core-audio-v1\n'
const NAV_TIMEOUT_MS = 4000
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest'])

const SCOPE = self.registration.scope // e.g. https://host/ or https://host/moonrise/
const START_URL = new URL('./', SCOPE).href
const SELF_URL = new URL('sw.js', SCOPE).href
const ASSET_DIR = new URL('assets/', SCOPE).href
const POINTER_URL = new URL('__moonrise_committed_shell__', SCOPE).href

self.addEventListener('install', (event) => {
  // Must succeed; otherwise the browser keeps the previous worker and its shell.
  event.waitUntil(cacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const committed = await readPointer()
      const keep = new Set([META_CACHE, RUNTIME_CACHE, AUDIO_CACHE, committed?.name, ...(committed?.audioArchives || []).map(item => item.name)])
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('moonrise-') && !keep.has(k)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

// This runs only after activation: registerServiceWorker and the music card send
// these messages to the active worker. A slow library never delays clients.claim.
self.addEventListener('message', event => {
  if (event.data?.type === 'MOONRISE_AUDIO_STATUS') {
    event.waitUntil(audioStatus().then(status => event.ports?.[0]?.postMessage(status)))
  } else if (event.data?.type === 'MOONRISE_DOWNLOAD_AUDIO') {
    event.waitUntil(downloadLibrary())
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (!req.url.startsWith(SCOPE) || new URL(req.url).origin !== self.location.origin) return
  if (req.url === SELF_URL || req.url === POINTER_URL) return

  if (req.mode === 'navigate') {
    event.respondWith(navigate(event))
    return
  }
  if (req.destination === 'audio' && isBundledAudio(req.url)) {
    event.respondWith(bundledAudio(event))
    return
  }
  // fetch()/XHR (destination '') and anything that isn't a static file: not intercepted.
  if (!STATIC_DESTINATIONS.has(req.destination)) return
  event.respondWith(staticFile(req))
})

async function navigate(event) {
  try {
    const res = await withTimeout(fetch(event.request), NAV_TIMEOUT_MS)
    if (res.ok) event.waitUntil(cacheShell().then(() => downloadLibrary()).catch(() => {}))
    return res
  } catch {
    return (await matchShell(START_URL)) ?? offlinePage()
  }
}

async function staticFile(req) {
  const fromShell = await matchShell(req.url)
  if (fromShell) return fromShell
  if (!req.url.startsWith(ASSET_DIR)) return fetch(req) // passed through, never cached

  const hit = await caches.match(req.url, { cacheName: RUNTIME_CACHE })
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE)
    await cache.put(req.url, res.clone())
  }
  return res
}

function isBundledAudio(url) {
  // Only approved recordings are permitted, including their Vite content hash.
  // Exact membership in the committed shell is checked before serving cached bytes.
  if (!url.startsWith(ASSET_DIR)) return false
  return BUNDLED_AUDIO_FILES.some(stem => new RegExp(`^${stem}-[A-Za-z0-9_-]+\\.mp3$`).test(url.slice(ASSET_DIR.length)))
}

function isCoreAudio(url) {
  return isBundledAudio(url) && url.slice(ASSET_DIR.length).startsWith(`${CORE_AUDIO_STEM}-`)
}

function isFullAudio(response) {
  return response?.status === 200 && !response.headers.has('Content-Range') &&
    /^audio\/(?:mpeg|mp3)(?:;|$)/i.test(response.headers.get('Content-Type') || '') &&
    response.headers.get('Content-Length') !== '0'
}

function declaredAudio(pointer) {
  return (pointer?.audioUrls || pointer?.urls || []).filter(isBundledAudio)
}

async function cachedAudio(url, pointer = undefined) {
  if (!isBundledAudio(url)) return undefined
  const committed = pointer || await readPointer()
  let response
  if (committed?.urls.includes(url)) response = await caches.match(url, { cacheName: committed.name })
  if (isFullAudio(response)) return response
  response = await caches.match(url, { cacheName: AUDIO_CACHE })
  if (isFullAudio(response)) return response
  // Retain only explicitly referenced, previously committed v5 audio. Never
  // search arbitrary/partially built shell caches for a recording.
  for (const archive of committed?.audioArchives || []) {
    if (!archive.urls.includes(url)) continue
    response = await caches.match(url, { cacheName: archive.name })
    if (isFullAudio(response)) return response
  }
  return undefined
}

let libraryDownload = null
const audioDownloads = new Map()

async function audioStatus() {
  const pointer = await readPointer()
  const cachedUrls = []
  for (const url of declaredAudio(pointer)) if (await cachedAudio(url, pointer)) cachedUrls.push(url)
  return { type: 'MOONRISE_AUDIO_STATUS', version: 1, cachedUrls, downloading: Boolean(libraryDownload || audioDownloads.size) }
}

async function broadcastAudioStatus() {
  const status = await audioStatus()
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) client.postMessage(status)
}

function downloadAudio(url) {
  if (audioDownloads.has(url)) return audioDownloads.get(url)
  const task = (async () => {
    const pointer = await readPointer()
    if (!declaredAudio(pointer).includes(url) || isCoreAudio(url) || await cachedAudio(url, pointer)) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      // A new full request, never the player's potentially partial Range response.
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
      if (response.type !== 'basic' || response.redirected || !isFullAudio(response)) throw new Error('invalid audio response')
      const bytes = await response.arrayBuffer()
      if (!bytes.byteLength) throw new Error('empty audio response')
      const headers = new Headers(response.headers)
      headers.delete('Content-Encoding')
      headers.set('Content-Length', String(bytes.byteLength))
      const cache = await caches.open(AUDIO_CACHE)
      // A failed put leaves any previously cached immutable recording untouched.
      await cache.put(url, new Response(bytes, { status: 200, headers }))
    } finally {
      clearTimeout(timer)
    }
  })().catch(() => {}).finally(async () => {
    audioDownloads.delete(url)
    await broadcastAudioStatus().catch(() => {})
  })
  audioDownloads.set(url, task)
  return task
}

function downloadLibrary() {
  if (libraryDownload) return libraryDownload
  libraryDownload = (async () => {
    const pointer = await readPointer()
    await broadcastAudioStatus().catch(() => {})
    for (const url of declaredAudio(pointer)) if (!isCoreAudio(url)) await downloadAudio(url)
  })().finally(async () => {
    libraryDownload = null
    await broadcastAudioStatus().catch(() => {})
  })
  return libraryDownload
}

async function bundledAudio(event) {
  const req = event.request
  const full = await cachedAudio(req.url)
  // Preserve the original Range request on a miss. Independently try one full
  // download of an exact declared extra URL; unknown URLs are never downloaded.
  if (!full) event.waitUntil(downloadAudio(req.url))
  if (!full || full.status !== 200) return fetch(req)
  const bytes = await full.arrayBuffer()
  const size = bytes.byteLength
  const headers = new Headers(full.headers)
  headers.delete('Content-Encoding')
  headers.delete('Content-Range')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Length', String(size))
  const entire = () => new Response(bytes, { status: 200, headers })
  const range = req.headers.get('Range')
  if (!range) return entire()

  // Conservatively return the entire representation unless a conditional request
  // exactly matches a strong ETag. Weak/date/unknown validators are not assumed safe.
  const validator = req.headers.get('If-Range')
  if (validator && (validator.startsWith('W/') || validator !== full.headers.get('ETag') || !validator.startsWith('"'))) return entire()
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!match || (!match[1] && !match[2])) return entire() // includes unsupported multi-range

  let start
  let end
  if (!match[1]) {
    const suffix = Number(match[2])
    start = suffix > 0 ? Math.max(0, size - suffix) : size
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] ? Number(match[2]) : size - 1
    if (match[2] && end < start) return entire() // syntactically invalid interval
    end = Math.min(end, size - 1)
  }
  if (start >= size || size === 0) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.set('Content-Length', '0')
    return new Response(null, { status: 416, headers })
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(bytes.slice(start, end + 1), { status: 206, headers })
}

// ---- Committed shell -------------------------------------------------------------------

async function readPointer() {
  const res = await caches.match(POINTER_URL, { cacheName: META_CACHE })
  if (!res) return null
  try {
    const pointer = await res.json()
    return typeof pointer?.name === 'string' && Array.isArray(pointer.urls) ? pointer : null
  } catch {
    return null
  }
}

async function writePointer(pointer) {
  const meta = await caches.open(META_CACHE)
  await meta.put(POINTER_URL, new Response(JSON.stringify(pointer), { headers: { 'Content-Type': 'application/json' } }))
}

async function isComplete(pointer) {
  if (!pointer || !(await caches.has(pointer.name))) return false
  for (const url of pointer.urls) {
    const res = await caches.match(url, { cacheName: pointer.name })
    if (!res) return false
    if (isBundledAudio(url)) {
      // A static host may return its HTML fallback with status 200 for a missing
      // MP3. Do not commit that, a partial response, or an empty audio response.
      // GitHub Pages serves this MP3 as audio/mp3 rather than audio/mpeg.
      if (!isFullAudio(res)) return false
      if (!(await res.arrayBuffer()).byteLength) return false
    }
  }
  return true
}

// Only ever reads the committed shell, and only URLs that belong to it.
async function matchShell(url) {
  const pointer = await readPointer()
  if (!pointer || !pointer.urls.includes(url)) return undefined
  return caches.match(url, { cacheName: pointer.name })
}

// One shell build at a time.
let shellQueue = Promise.resolve()
function cacheShell() {
  const run = shellQueue.then(buildShell)
  shellQueue = run.catch(() => {})
  return run
}

async function buildShell() {
  const res = await fetch(START_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`start page HTTP ${res.status}`)
  const html = await res.clone().text()
  const committed = await readPointer()
  const files = referencedFiles(html)
  const name = SHELL_PREFIX + (await shortHash(SHELL_PROTOCOL + html))
  const audioArchives = [...(committed?.audioArchives || [])]
  if (committed?.urls.some(url => isBundledAudio(url) && !isCoreAudio(url)) && !audioArchives.some(item => item.name === committed.name)) {
    audioArchives.push({ name: committed.name, urls: committed.urls.filter(isBundledAudio) })
  }
  const pointer = { name, urls: [START_URL, ...files.filter(url => !isBundledAudio(url) || isCoreAudio(url))],
    audioUrls: files.filter(isBundledAudio), audioArchives, builtAt: new Date().toISOString() }
  if (committed?.name === name && (await isComplete(committed))) return

  // Anything already stored under this name is uncommitted (or broken): start clean.
  await caches.delete(name)
  try {
    const cache = await caches.open(name)
    await cache.addAll(pointer.urls.slice(1))
    await cache.put(START_URL, res)
    if (!(await isComplete(pointer))) throw new Error('shell incomplete after download')
  } catch (err) {
    await caches.delete(name)
    throw err
  }

  await writePointer(pointer) // commit: the last write
  const keys = await caches.keys()
  const keep = new Set([name, ...audioArchives.map(item => item.name)])
  await Promise.all(keys.filter((k) => k.startsWith(SHELL_PREFIX) && !keep.has(k)).map((k) => caches.delete(k)))
}

function referencedFiles(html) {
  const found = new Set()
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], START_URL)
    url.hash = ''
    if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) continue
    if (url.href === START_URL || url.href === SELF_URL) continue
    found.add(url.href)
  }
  return [...found]
}

// ---- Helpers ---------------------------------------------------------------------------

async function shortHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Moonrise</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1026;color:#f4f1ea;
font:22px/1.5 system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:32px}</style></head>
<body><div><h1>Moonrise needs one online visit</h1>
<p>Connect to the internet and open Moonrise once. After that it works without a connection.</p></div></body></html>`
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
