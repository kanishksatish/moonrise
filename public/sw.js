// Moonrise service worker: makes the app open with no signal after one online visit.
//
// What it caches: ONLY this app's static shell (the start page plus the same-origin files it
// references: Vite's hashed JS/CSS, the manifest and the icon). Never API responses, never
// cross-origin requests, never non-GET requests; those go straight to the network untouched.
//
// Vite hashes bundle names, so nothing here hardcodes them. After each online load of the
// start page, the worker reads that HTML, collects the files it references, and stores the
// whole set in a cache named after a hash of the HTML ("one cache per build").
//
// Update strategy:
//   - Start page: network first (4 s timeout), cached copy when offline.
//   - A new build's shell is cached completely (all-or-nothing) BEFORE the previous shell is
//     deleted, so an offline reload never mixes one build's HTML with another build's assets.
//   - Hashed assets: cache first (their names change whenever their content does).
//   - SW_VERSION: bump only when this file's logic changes; activation deletes every cache
//     from older logic versions.
//   - No shell cached yet (first visit offline, or the first caching failed): the start page
//     shows a short "connect once" message instead of a browser error.

const SW_VERSION = 'v1'
const SHELL_PREFIX = `moonrise-shell-${SW_VERSION}-`
// A shell being downloaded lives here until complete; it never matches SHELL_PREFIX,
// so a half-downloaded build is never served.
const BUILDING_PREFIX = `moonrise-building-${SW_VERSION}-`
const RUNTIME_CACHE = `moonrise-runtime-${SW_VERSION}`
const NAV_TIMEOUT_MS = 4000

const SCOPE = self.registration.scope // e.g. https://host/ or https://host/moonrise/
const START_URL = new URL('./', SCOPE).href
const SELF_URL = new URL('sw.js', SCOPE).href

self.addEventListener('install', (event) => {
  // Try to cache the shell right away; if we're offline, the next online load will.
  event.waitUntil(cacheShell().catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('moonrise-') && !k.startsWith(SHELL_PREFIX) && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return
  if (req.url === SELF_URL) return

  if (req.mode === 'navigate') {
    event.respondWith(navigate(event))
  } else {
    event.respondWith(cacheFirst(req))
  }
})

async function navigate(event) {
  try {
    const res = await withTimeout(fetch(event.request), NAV_TIMEOUT_MS)
    if (res.ok) event.waitUntil(cacheShell().catch(() => {}))
    return res
  } catch {
    const cached = await matchShell(START_URL)
    return cached ?? offlinePage()
  }
}

async function cacheFirst(req) {
  const hit = (await matchShell(req.url)) ?? (await caches.match(req, { cacheName: RUNTIME_CACHE }))
  if (hit) return hit
  const res = await fetch(req)
  // Files only reached from JS/CSS (e.g. lazy chunks) are kept too, same origin only.
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(req, res.clone())
  }
  return res
}

// Look only in the current shell cache(s), so a half-built new shell is never used.
async function matchShell(url) {
  const keys = (await caches.keys()).filter((k) => k.startsWith(SHELL_PREFIX))
  for (const key of keys) {
    const cache = await caches.open(key)
    const hit = await cache.match(url)
    if (hit) return hit
  }
  return undefined
}

// Fetch the start page, and if it's a build we haven't cached, cache it with every
// same-origin file it references. Only then delete older shells.
async function cacheShell() {
  const res = await fetch(START_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`start page HTTP ${res.status}`)
  const html = await res.clone().text()
  const name = SHELL_PREFIX + (await shortHash(html))
  const keys = await caches.keys()
  if (keys.includes(name)) return

  const assets = referencedFiles(html)
  const buildingName = BUILDING_PREFIX + name.slice(SHELL_PREFIX.length)
  const temp = await caches.open(buildingName)
  try {
    await temp.addAll(assets)
  } catch (err) {
    await caches.delete(buildingName)
    throw err
  }
  const shell = await caches.open(name)
  await shell.put(START_URL, res)
  for (const req of await temp.keys()) await shell.put(req, await temp.match(req))
  await caches.delete(buildingName)

  await Promise.all(keys.filter((k) => k.startsWith(SHELL_PREFIX) && k !== name).map((k) => caches.delete(k)))
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
