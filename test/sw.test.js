// Unit tests for public/sw.js: the real worker source runs in a VM with a fake CacheStorage,
// a fake server and injectable failures, so the failure paths a browser test can't easily
// hit (a failed cache write, a worker stopped mid-build, a failed update) are covered.
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const audioCatalog = JSON.parse(fs.readFileSync(new URL('../src/assets/audio/catalog.json', import.meta.url), 'utf8'))

const SW_SOURCE = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://app.test'
const SCOPE = `${ORIGIN}/`

it('declares bundled audio for the shell without an active media element or resource hint', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { url: SCOPE })
  try {
    const { document } = dom.window
    expect(document.querySelector('audio')).toBeNull()
    expect(document.querySelector('link[as="audio"]')).toBeNull()
    expect(document.querySelector('[src$=".mp3"], [href$=".mp3"]')).toBeNull()
    const core = [...document.getElementById('offline-audio-assets').content.querySelectorAll('audio')]
    expect(core.map(audio => audio.getAttribute('src'))).toEqual(['/src/assets/audio/fur-elise-v-gao.mp3'])
    const recordings = [...core, ...document.getElementById('offline-extra-audio-assets').content.querySelectorAll('audio')]
    expect(recordings.map(audio => audio.getAttribute('src')).sort()).toEqual(audioCatalog.map(item => `/src/assets/audio/${item.filename}`).sort())
    expect(recordings.every(audio => !audio.isConnected)).toBe(true)
  } finally {
    dom.window.close()
  }
})

// ---- Fakes -------------------------------------------------------------------------------

class FakeCache {
  constructor(storage, name) {
    this.storage = storage
    this.name = name
    this.entries = new Map()
  }
  async put(req, res) {
    const url = typeof req === 'string' ? req : req.url
    this.storage.faults.beforePut?.(this.name, url)
    if (res.status === 206) throw new TypeError('Cache.put cannot store a partial response')
    const body = new Uint8Array(await res.clone().arrayBuffer())
    this.entries.set(url, { body, status: res.status, headers: [...res.headers] })
  }
  async match(req) {
    const url = typeof req === 'string' ? req : req.url
    const e = this.entries.get(url)
    return e ? new Response(e.body, { status: e.status, headers: e.headers }) : undefined
  }
  async addAll(urls) {
    const fetched = []
    for (const url of urls) {
      const res = await this.storage.fetch(url)
      if (!res.ok || res.status === 206) throw new TypeError(`addAll: ${res.status} ${url}`)
      fetched.push([url, res])
    }
    for (const [url, res] of fetched) await this.put(url, res)
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }))
  }
}

class FakeCacheStorage {
  constructor(fetch) {
    this.fetch = fetch
    this.caches = new Map()
    this.faults = {}
  }
  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new FakeCache(this, name))
    return this.caches.get(name)
  }
  async has(name) {
    return this.caches.has(name)
  }
  async delete(name) {
    return this.caches.delete(name)
  }
  async keys() {
    return [...this.caches.keys()]
  }
  async match(req, { cacheName } = {}) {
    const names = cacheName ? [cacheName] : [...this.caches.keys()]
    for (const n of names) {
      const hit = await this.caches.get(n)?.match(req)
      if (hit) return hit
    }
    return undefined
  }
}

function makeServer() {
  const server = { down: false, files: new Map(), requests: [] }
  server.deploy = (build) => {
    server.files = new Map(Object.entries(build).map(([p, body]) => [ORIGIN + p, body]))
  }
  server.fetch = async (input) => {
    server.lastInput = input
    const url = typeof input === 'string' ? input : input.url
    server.requests.push(url)
    if (server.down) throw new TypeError('Failed to fetch')
    const stored = server.files.get(url)
    const res = server.files.has(url)
      ? stored instanceof Response ? stored.clone() : new Response(stored, { status: 200, headers: url.endsWith('.mp3') ? { 'Content-Type': 'audio/mpeg' } : {} })
      : new Response('not found', { status: 404 })
    // Same-origin responses in a browser have type "basic"; Node's Response says "default".
    Object.defineProperty(res, 'type', { value: 'basic' })
    return res
  }
  return server
}

function build(tag) {
  return {
    '/': `<!doctype html><html><head><link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/icon.svg" /><script type="module" src="/assets/index-${tag}.js"></script>
<link rel="stylesheet" href="/assets/index-${tag}.css"></head><body><div id="root"></div></body></html>`,
    [`/assets/index-${tag}.js`]: `console.log('${tag}')`,
    [`/assets/index-${tag}.css`]: `body{}`,
    '/manifest.webmanifest': '{}',
    '/icon.svg': '<svg/>',
    '/sw.js': '// worker',
    '/api/status': '{"ok":true}',
  }
}

// Load a fresh copy of the worker (a new worker version or a restarted worker) over shared caches.
function loadWorker(caches, server, scope = SCOPE) {
  const handlers = {}
  const messages = []
  const self = {
    registration: { scope },
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [{ postMessage: message => messages.push(message) }] },
  }
  const context = vm.createContext({
    self,
    caches,
    fetch: server.fetch,
    Response,
    Request,
    Headers,
    AbortController,
    URL,
    TextEncoder,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    Promise,
    Set,
    Map,
    JSON,
    Array,
    Uint8Array,
    Error,
    TypeError,
    Date,
    console,
  })
  vm.runInContext(SW_SOURCE, context)

  const worker = {
    messages,
    async message(type) {
      let promise
      let reply
      handlers.message({ data: { type }, ports: [{ postMessage: value => { reply = value } }], waitUntil: value => { promise = value } })
      await promise
      return reply
    },
    async install() {
      let p
      handlers.install({ waitUntil: (x) => (p = x) })
      return p
    },
    async activate() {
      let p
      handlers.activate({ waitUntil: (x) => (p = x) })
      return p
    },
    // Returns { intercepted, response, background } for a request.
    async request(path, { mode = 'no-cors', destination = '', method = 'GET', url, headers = {} } = {}) {
      const request = { url: url ?? ORIGIN + path, mode, destination, method, headers: new Headers(headers) }
      let responded
      const background = []
      handlers.fetch({ request, respondWith: (p) => (responded = p), waitUntil: (p) => background.push(p) })
      if (!responded) return { intercepted: false }
      const response = await responded
      await Promise.all(background)
      return { intercepted: true, response, text: await response.clone().text(), bytes: new Uint8Array(await response.clone().arrayBuffer()), status: response.status }
    },
    navigate(path = '/') {
      return this.request(path, { mode: 'navigate', destination: 'document' })
    },
  }
  return worker
}

async function committed(caches) {
  const res = await caches.match(`${SCOPE}__moonrise_committed_shell__`, { cacheName: 'moonrise-meta' })
  return res ? res.json() : null
}
const shellNames = async (caches) => (await caches.keys()).filter((k) => k.startsWith('moonrise-shell-'))

// ---- Tests -------------------------------------------------------------------------------

let server
let caches
beforeEach(() => {
  server = makeServer()
  caches = new FakeCacheStorage(server.fetch)
})

describe('first install', () => {
  it('commits a complete shell: start page, hashed JS/CSS, manifest, icon', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    await sw.install()
    const pointer = await committed(caches)
    expect(pointer.urls.map((u) => u.replace(ORIGIN, '')).sort()).toEqual(
      ['/', '/assets/index-A.css', '/assets/index-A.js', '/icon.svg', '/manifest.webmanifest'].sort()
    )
    for (const url of pointer.urls) expect(await caches.match(url, { cacheName: pointer.name })).toBeTruthy()
    expect(await shellNames(caches)).toEqual([pointer.name])
  })

  it('fails (so the browser retries later) when offline, leaving nothing half-built', async () => {
    server.deploy(build('A'))
    server.down = true
    const sw = loadWorker(caches, server)
    await expect(sw.install()).rejects.toThrow()
    expect(await committed(caches)).toBeNull()
    expect(await shellNames(caches)).toEqual([])
  })

  it('serves the "connect once" page offline when no shell was ever committed', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    server.down = true
    const r = await sw.navigate()
    expect(r.status).toBe(503)
    expect(r.text).toContain('one online visit')
  })
})

describe('offline use', () => {
  it('serves the committed start page and its assets when the server is down', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    await sw.install()
    server.down = true
    expect((await sw.navigate()).text).toContain('index-A.js')
    const js = await sw.request('/assets/index-A.js', { destination: 'script' })
    expect(js.text).toBe("console.log('A')")
  })
})

describe('failed writes never produce a servable incomplete shell', () => {
  it('a failed asset write during an update keeps serving the old build, and a retry repairs it', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    await sw.install()
    const shellA = (await committed(caches)).name

    // Deploy B; the first write of B's JS into its shell cache fails once.
    server.deploy(build('B'))
    let failures = 0
    caches.faults.beforePut = (cacheName, url) => {
      if (cacheName.startsWith('moonrise-shell-') && cacheName !== shellA && url.endsWith('index-B.js') && failures++ === 0) {
        throw new Error('QuotaExceededError (injected)')
      }
    }
    const online = await sw.navigate()
    expect(online.text).toContain('index-B.js') // online load still gets B from the network
    expect((await committed(caches)).name).toBe(shellA) // B not committed
    expect(await shellNames(caches)).toEqual([shellA]) // B's partial cache discarded

    server.down = true
    const offline = await sw.navigate()
    expect(offline.text).toContain('index-A.js') // never B's HTML without B's JS
    expect((await sw.request('/assets/index-A.js', { destination: 'script' })).text).toBe("console.log('A')")

    // Next online load repairs: B is committed complete, A removed.
    server.down = false
    await sw.navigate()
    const pointer = await committed(caches)
    expect(pointer.name).not.toBe(shellA)
    expect(await caches.match(`${ORIGIN}/assets/index-B.js`, { cacheName: pointer.name })).toBeTruthy()
    expect(await shellNames(caches)).toEqual([pointer.name])
    server.down = true
    expect((await sw.request('/assets/index-B.js', { destination: 'script' })).text).toBe("console.log('B')")
  })

  it('a worker stopped mid-build leaves a partial cache that is never served and is rebuilt', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    await sw.install()
    const shellA = (await committed(caches)).name

    // Simulate a worker killed after writing B's HTML but before its assets or the commit.
    server.deploy(build('B'))
    const hashB = await (async () => {
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('core-audio-v1\n' + build('B')['/']))
      return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
    })()
    const partial = await caches.open(`moonrise-shell-${hashB}`)
    await partial.put(SCOPE, new Response(build('B')['/']))

    const restarted = loadWorker(caches, server)
    server.down = true
    expect((await restarted.navigate()).text).toContain('index-A.js')
    // B's JS was never committed, so offline it is a plain network error, not a partial-cache hit.
    await expect(restarted.request('/assets/index-B.js', { destination: 'script' })).rejects.toThrow('Failed to fetch')
    expect((await committed(caches)).name).toBe(shellA)

    server.down = false
    await restarted.navigate()
    const pointer = await committed(caches)
    expect(pointer.name).toBe(`moonrise-shell-${hashB}`)
    expect(await caches.match(`${ORIGIN}/assets/index-B.js`, { cacheName: pointer.name })).toBeTruthy()
  })

  it('a missing asset (404) aborts the build instead of committing a broken shell', async () => {
    const broken = build('A')
    delete broken['/assets/index-A.css']
    server.deploy(broken)
    const sw = loadWorker(caches, server)
    await expect(sw.install()).rejects.toThrow()
    expect(await committed(caches)).toBeNull()
    expect(await shellNames(caches)).toEqual([])
  })
})

describe('worker logic updates', () => {
  it('a failed install of a new worker keeps the old committed shell', async () => {
    server.deploy(build('A'))
    await loadWorker(caches, server).install()
    const before = await committed(caches)

    server.down = true
    const v2 = loadWorker(caches, server)
    await expect(v2.install()).rejects.toThrow() // browser keeps the old worker; no activate
    expect(await committed(caches)).toEqual(before)
    expect(await caches.match(`${ORIGIN}/assets/index-A.js`, { cacheName: before.name })).toBeTruthy()
  })

  it('a successful update activates and removes only stale caches', async () => {
    server.deploy(build('A'))
    await loadWorker(caches, server).install()
    const pointer = await committed(caches)
    // Leftovers from older worker versions.
    await caches.open('moonrise-shell-v1-deadbeef')
    await caches.open('moonrise-runtime-v1')
    await caches.open('moonrise-building-v1-x')
    await caches.open('someone-elses-cache')

    const v2 = loadWorker(caches, server)
    await v2.install()
    await v2.activate()
    expect((await caches.keys()).sort()).toEqual(['moonrise-meta', pointer.name, 'someone-elses-cache'].sort())
    expect(await committed(caches)).toEqual(pointer)
  })

  it('serializes concurrent shell builds', async () => {
    server.deploy(build('A'))
    const sw = loadWorker(caches, server)
    await Promise.all([sw.install(), sw.navigate(), sw.navigate()])
    const jsFetches = server.requests.filter((u) => u.endsWith('index-A.js')).length
    expect(jsFetches).toBe(1)
    expect(await shellNames(caches)).toHaveLength(1)
  })
})

describe('static-only caching', () => {
  let sw
  beforeEach(async () => {
    server.deploy(build('A'))
    sw = loadWorker(caches, server)
    await sw.install()
  })
  const everyCachedUrl = async () => {
    const out = []
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url)
    return out
  }

  it('does not intercept same-origin fetch()/XHR API requests at all', async () => {
    const r = await sw.request('/api/status', { destination: '' })
    expect(r.intercepted).toBe(false)
    expect((await everyCachedUrl()).some((u) => u.includes('/api/'))).toBe(false)
  })

  it('does not cache a static-looking request outside the shell and assets/', async () => {
    server.files.set(`${ORIGIN}/api/chart.png`, 'png')
    const r = await sw.request('/api/chart.png', { destination: 'image' })
    expect(r.text).toBe('png')
    expect((await everyCachedUrl()).some((u) => u.includes('/api/'))).toBe(false)
  })

  it('caches a lazy chunk under assets/ at runtime', async () => {
    server.files.set(`${ORIGIN}/assets/lazy-XYZ.js`, 'lazy')
    await sw.request('/assets/lazy-XYZ.js', { destination: 'script' })
    server.down = true
    expect((await sw.request('/assets/lazy-XYZ.js', { destination: 'script' })).text).toBe('lazy')
  })

  it('ignores cross-origin, non-GET and out-of-scope requests', async () => {
    expect((await sw.request('', { url: 'https://api.open-meteo.com/v1/forecast', destination: '' })).intercepted).toBe(false)
    expect((await sw.request('', { url: 'https://cdn.test/x.js', destination: 'script' })).intercepted).toBe(false)
    expect((await sw.request('/assets/index-A.js', { destination: 'script', method: 'POST' })).intercepted).toBe(false)
    expect((await sw.request('/sw.js', { destination: 'script' })).intercepted).toBe(false)
  })
})

describe('base path', () => {
  it('works under a sub-path scope', async () => {
    const sub = makeServer()
    const html = build('S')['/'].replaceAll('"/', '"/moonrise/')
    sub.files = new Map([
      [`${ORIGIN}/moonrise/`, html],
      [`${ORIGIN}/moonrise/assets/index-S.js`, 'js'],
      [`${ORIGIN}/moonrise/assets/index-S.css`, 'css'],
      [`${ORIGIN}/moonrise/manifest.webmanifest`, '{}'],
      [`${ORIGIN}/moonrise/icon.svg`, '<svg/>'],
    ])
    const subCaches = new FakeCacheStorage(sub.fetch)
    const handlers = {}
    const self = {
      registration: { scope: `${ORIGIN}/moonrise/` },
      location: { origin: ORIGIN },
      addEventListener: (t, fn) => (handlers[t] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    }
    const ctx = vm.createContext({ self, caches: subCaches, fetch: sub.fetch, Response, Headers, URL, TextEncoder, crypto: globalThis.crypto, setTimeout, clearTimeout })
    vm.runInContext(SW_SOURCE, ctx)
    let p
    handlers.install({ waitUntil: (x) => (p = x) })
    await p
    const pointer = await (await subCaches.match(`${ORIGIN}/moonrise/__moonrise_committed_shell__`, { cacheName: 'moonrise-meta' })).json()
    expect(pointer.urls).toContain(`${ORIGIN}/moonrise/assets/index-S.js`)
    expect(pointer.urls).toContain(`${ORIGIN}/moonrise/`)
  })
})

// Includes bytes that are not valid UTF-8, so a text-based cache fake would fail.
const AUDIO_BYTES = new Uint8Array([73, 68, 51, 0, 255, 128, 1, 254, 7, 0, 192, 175, 250, 21, 22, 23])
const audioPath = tag => `/assets/fur-elise-v-gao-${tag}.mp3`
const libraryStems = audioCatalog.map(item => item.filename.replace(/\.mp3$/, ''))
function libraryBuild(tag) {
  const files = build(tag)
  const declarations = libraryStems.map(stem => `<audio src="/assets/${stem}-${tag}.mp3"></audio>`).join('')
  files['/'] = files['/'].replace('</head>', `<template id="offline-audio-assets">${declarations}</template></head>`)
  libraryStems.forEach((stem, i) => {
    const bytes = new Uint8Array([...AUDIO_BYTES, i])
    files[`/assets/${stem}-${tag}.mp3`] = new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })
  })
  return files
}

describe('included recording library offline playback', () => {
  it('installs and activates core plus piano without requesting any extra recording', async () => {
    const files = libraryBuild('weak')
    for (const stem of libraryStems.slice(1)) delete files[`/assets/${stem}-weak.mp3`]
    server.deploy(files)
    const sw = loadWorker(caches, server)
    await sw.install()
    await sw.activate()
    expect(server.requests.filter(url => url.endsWith('.mp3'))).toEqual([ORIGIN + audioPath('weak')])
    expect(await sw.message('MOONRISE_AUDIO_STATUS')).toMatchObject({ version: 1, cachedUrls: [ORIGIN + audioPath('weak')], downloading: false })
    server.down = true
    expect((await sw.navigate()).text).toContain('index-weak.js')
    expect((await sw.request(audioPath('weak'), { destination: 'audio', headers: { Range: 'bytes=4-7' } })).bytes).toEqual(AUDIO_BYTES.slice(4, 8))
  })

  it('preserves a partial library across worker restarts and retries only missing recordings', async () => {
    const files = libraryBuild('partial')
    const missing = libraryStems.slice(4).map(stem => `/assets/${stem}-partial.mp3`)
    for (const path of missing) delete files[path]
    server.deploy(files)
    const first = loadWorker(caches, server)
    await first.install()
    await first.activate()
    await first.message('MOONRISE_DOWNLOAD_AUDIO')
    expect((await first.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toHaveLength(4)
    expect(first.messages.at(-1).downloading).toBe(false)
    server.down = true
    const restarted = loadWorker(caches, server)
    expect((await restarted.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toHaveLength(4)
    const cachedPath = `/assets/${libraryStems[2]}-partial.mp3`
    expect((await restarted.request(cachedPath, { destination: 'audio', headers: { Range: 'bytes=-1' } })).bytes).toEqual(new Uint8Array([2]))
    expect((await restarted.request(audioPath('partial'), { destination: 'audio', headers: { Range: 'bytes=0-1' } })).status).toBe(206)
    await expect(restarted.request(missing[0], { destination: 'audio' })).rejects.toThrow('Failed to fetch')
    server.down = false
    server.deploy(libraryBuild('partial'))
    server.requests = []
    await restarted.message('MOONRISE_DOWNLOAD_AUDIO')
    expect((await restarted.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toHaveLength(libraryStems.length)
    expect(server.requests.sort()).toEqual(missing.map(path => ORIGIN + path).sort())
  })

  it('keeps completed extra downloads visible while another recording is still pending', async () => {
    server.deploy(libraryBuild('slow'))
    const originalFetch = server.fetch
    let release
    let started
    const waiting = new Promise(resolve => { started = resolve })
    const slowUrl = `${ORIGIN}/assets/${libraryStems[2]}-slow.mp3`
    server.fetch = async (request, options) => {
      if (request === slowUrl) {
        started()
        await new Promise(resolve => { release = resolve })
      }
      return originalFetch(request, options)
    }
    const sw = loadWorker(caches, server)
    await sw.install()
    await sw.activate()
    const downloading = sw.message('MOONRISE_DOWNLOAD_AUDIO')
    await waiting
    expect((await sw.message('MOONRISE_AUDIO_STATUS'))).toMatchObject({ downloading: true, cachedUrls: [ORIGIN + audioPath('slow'), `${ORIGIN}/assets/${libraryStems[1]}-slow.mp3`] })
    const restarted = loadWorker(caches, server)
    expect((await restarted.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toHaveLength(2)
    release()
    await downloading
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).downloading).toBe(false)
  })

  it('migrates previously committed v5 audio without deleting it or copying it under quota pressure', async () => {
    const old = libraryBuild('legacy')
    server.deploy(old)
    const oldName = 'moonrise-shell-v5-complete'
    const oldUrls = [SCOPE, ...Object.keys(old).filter(path => path !== '/' && path !== '/sw.js' && path !== '/api/status').map(path => ORIGIN + path)]
    const oldCache = await caches.open(oldName)
    for (const url of oldUrls) await oldCache.put(url, await server.fetch(url))
    const meta = await caches.open('moonrise-meta')
    await meta.put(`${SCOPE}__moonrise_committed_shell__`, new Response(JSON.stringify({ name: oldName, urls: oldUrls })))
    server.deploy(libraryBuild('current'))
    caches.faults.beforePut = (name) => { if (name === 'moonrise-audio-v1') throw new Error('Audio quota exceeded') }
    const sw = loadWorker(caches, server)
    await sw.install()
    await sw.activate()
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    expect(await caches.has(oldName)).toBe(true)
    expect((await committed(caches)).audioArchives).toHaveLength(1)
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toEqual([ORIGIN + audioPath('current')])
    server.down = true
    const restarted = loadWorker(caches, server)
    for (const [i, stem] of libraryStems.entries()) {
      const reply = await restarted.request(`/assets/${stem}-legacy.mp3`, { destination: 'audio', headers: { Range: 'bytes=-1' } })
      expect(reply.bytes).toEqual(new Uint8Array([i]))
    }
    expect((await restarted.navigate()).text).toContain('index-current.js')
  })

  it('serves a network Range response unchanged while caching only a separate validated full download', async () => {
    server.deploy(libraryBuild('demand'))
    const originalFetch = server.fetch
    const path = `/assets/${libraryStems[1]}-demand.mp3`
    server.fetch = async (request, options) => {
      if (request?.url === ORIGIN + path) return new Response(AUDIO_BYTES.slice(0, 2), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-1/17' } })
      return originalFetch(request, options)
    }
    const sw = loadWorker(caches, server)
    await sw.install()
    const response = await sw.request(path, { destination: 'audio', headers: { Range: 'bytes=0-1' } })
    expect(response.status).toBe(206)
    expect(response.bytes).toEqual(AUDIO_BYTES.slice(0, 2))
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toContain(ORIGIN + path)
    server.down = true
    expect((await sw.request(path, { destination: 'audio', headers: { Range: 'bytes=12-' } })).bytes).toEqual(new Uint8Array([...AUDIO_BYTES.slice(12), 1]))
  })

  it('does not download or cache an undeclared extra, even when its stem is approved', async () => {
    server.deploy(audioBuild('coreOnly'))
    const path = '/assets/gymnopedie-1-macleod-undeclared.mp3'
    server.files.set(ORIGIN + path, new Response(AUDIO_BYTES, { headers: { 'Content-Type': 'audio/mpeg' } }))
    const sw = loadWorker(caches, server)
    await sw.install()
    server.requests = []
    await sw.request(path, { destination: 'audio' })
    expect(server.requests).toEqual([ORIGIN + path])
    expect(await caches.match(ORIGIN + path)).toBeUndefined()
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toEqual([ORIGIN + audioPath('coreOnly')])
  })

  it.each(['redirected', 'cross-origin'])('does not cache an extra audio response that is %s', async kind => {
    server.deploy(libraryBuild('origin'))
    const path = `/assets/${libraryStems[1]}-origin.mp3`
    const originalFetch = server.fetch
    server.fetch = async (request, options) => {
      if (request === ORIGIN + path) {
        const response = new Response(AUDIO_BYTES, { headers: { 'Content-Type': 'audio/mpeg' } })
        Object.defineProperty(response, 'type', { value: kind === 'cross-origin' ? 'cors' : 'basic' })
        Object.defineProperty(response, 'redirected', { value: kind === 'redirected' })
        return response
      }
      return originalFetch(request, options)
    }
    const sw = loadWorker(caches, server)
    await sw.install()
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).cachedUrls).not.toContain(ORIGIN + path)
    expect(await caches.match(ORIGIN + path)).toBeUndefined()
  })

  it('reports scoped downloaded URLs and seeks extra recordings offline under /moonrise/', async () => {
    const sub = makeServer()
    sub.files = new Map(Object.entries(libraryBuild('subLibrary')).map(([path, value]) => [
      `${ORIGIN}/moonrise${path}`, path === '/' ? value.replaceAll('"/', '"/moonrise/') : value,
    ]))
    const subCaches = new FakeCacheStorage(sub.fetch)
    const sw = loadWorker(subCaches, sub, `${ORIGIN}/moonrise/`)
    await sw.install()
    await sw.activate()
    expect((await sw.message('MOONRISE_AUDIO_STATUS')).cachedUrls).toEqual([`${ORIGIN}/moonrise${audioPath('subLibrary')}`])
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    const status = await sw.message('MOONRISE_AUDIO_STATUS')
    expect(status.cachedUrls).toHaveLength(libraryStems.length)
    expect(status.cachedUrls.every(url => url.startsWith(`${ORIGIN}/moonrise/assets/`))).toBe(true)
    sub.down = true
    const path = `/moonrise/assets/${libraryStems[1]}-subLibrary.mp3`
    expect((await sw.request(path, { destination: 'audio', headers: { Range: 'bytes=-1' } })).bytes).toEqual(new Uint8Array([1]))
    expect((await sw.request(path.replace('/moonrise', ''), { destination: 'audio' })).intercepted).toBe(false)
  })

  it.each(libraryStems)('plays and seeks %s offline before it has ever been played', async stem => {
    server.deploy(libraryBuild('library'))
    const sw = loadWorker(caches, server)
    await sw.install()
    const pointer = await committed(caches)
    for (const name of libraryStems) expect(pointer.audioUrls).toContain(`${ORIGIN}/assets/${name}-library.mp3`)
    expect(pointer.urls.filter(url => url.endsWith('.mp3'))).toEqual([`${ORIGIN}${audioPath('library')}`])
    await sw.activate()
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    server.down = true
    const path = `/assets/${stem}-library.mp3`
    const bytes = new Uint8Array([...AUDIO_BYTES, libraryStems.indexOf(stem)])
    expect((await sw.request(path, { destination: 'audio' })).bytes).toEqual(bytes)
    for (const [range, from, to] of [['bytes=0-1', 0, 1], ['bytes=8-12', 8, 12], ['bytes=13-', 13, 16], ['bytes=-3', 14, 16]]) {
      const reply = await sw.request(path, { destination: 'audio', headers: { Range: range } })
      expect(reply.status).toBe(206)
      expect(reply.bytes).toEqual(bytes.slice(from, to + 1))
      expect(reply.response.headers.get('Content-Range')).toBe(`bytes ${from}-${to}/17`)
    }
    expect((await sw.request(path, { destination: 'audio' })).bytes).toEqual(bytes)
  })

  it.each(['missing', 'html', 'partial', 'empty', 'content-range', 'quota'])('activates core and preserves cached extras when one new recording is %s', async failure => {
    server.deploy(libraryBuild('old'))
    const sw = loadWorker(caches, server)
    await sw.install()
    await sw.activate()
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    const previous = await committed(caches)
    const next = libraryBuild('new')
    const failingPath = '/assets/gymnopedie-1-macleod-new.mp3'
    if (failure === 'missing') delete next[failingPath]
    if (failure === 'html') next[failingPath] = new Response('<html>Not audio</html>', { headers: { 'Content-Type': 'text/html' } })
    if (failure === 'partial') next[failingPath] = new Response(AUDIO_BYTES.slice(0, 2), { status: 206, headers: { 'Content-Type': 'audio/mpeg' } })
    if (failure === 'empty') next[failingPath] = new Response(null, { headers: { 'Content-Type': 'audio/mpeg' } })
    if (failure === 'content-range') next[failingPath] = new Response(AUDIO_BYTES, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-15/99' } })
    if (failure === 'quota') caches.faults.beforePut = (_name, url) => { if (url.endsWith(failingPath)) throw new Error('Storage full') }
    server.deploy(next)
    await sw.install()
    await sw.activate()
    expect((await committed(caches)).name).not.toBe(previous.name)
    await sw.message('MOONRISE_DOWNLOAD_AUDIO')
    const status = await sw.message('MOONRISE_AUDIO_STATUS')
    expect(status.cachedUrls).not.toContain(ORIGIN + failingPath)
    expect(status.cachedUrls).toHaveLength(libraryStems.length - 1)
    expect(status.downloading).toBe(false)
    server.down = true
    expect((await sw.navigate()).text).toContain('index-new.js')
    expect((await sw.request(audioPath('new'), { destination: 'audio', headers: { Range: 'bytes=0-1' } })).bytes).toEqual(AUDIO_BYTES.slice(0, 2))
    for (const [i, stem] of libraryStems.entries()) {
      if (stem === 'fur-elise-v-gao') continue // the newly committed core owns current piano
      const reply = await sw.request(`/assets/${stem}-old.mp3`, { destination: 'audio', headers: { Range: 'bytes=-1' } })
      expect(reply.bytes).toEqual(new Uint8Array([i]))
    }
  })

  it('restricts all catalog audio paths to explicit approved names and declared shell members', () => {
    const context = vm.createContext({ self: { registration: { scope: SCOPE }, location: { origin: ORIGIN }, addEventListener() {} }, URL, Set })
    vm.runInContext(SW_SOURCE, context)
    for (const item of audioCatalog) {
      const stem = item.filename.replace(/\.mp3$/, '')
      expect(context.isBundledAudio(`${SCOPE}assets/${stem}-testHash.mp3`)).toBe(true)
      expect(context.isBundledAudio(`${SCOPE}assets/${stem}-testHash.mp3?other=1`)).toBe(false)
    }
    expect(context.isBundledAudio(`${SCOPE}assets/unapproved-testHash.mp3`)).toBe(false)
  })
})

function audioBuild(tag, contentType = 'audio/mpeg') {
  const files = build(tag)
  files['/'] = files['/'].replace('</head>', `<template id="offline-audio-assets"><audio src="${audioPath(tag)}"></audio></template></head>`)
  files[audioPath(tag)] = new Response(AUDIO_BYTES, {
    headers: { 'Content-Type': contentType, 'Content-Length': String(AUDIO_BYTES.length), ETag: '"piano-v1"' },
  })
  return files
}

describe('bundled piano offline playback', () => {
  let sw
  beforeEach(async () => {
    server.deploy(audioBuild('A'))
    sw = loadWorker(caches, server)
    await sw.install()
    server.down = true
  })

  it('precaches the entire binary recording during install, before anyone plays it', async () => {
    const pointer = await committed(caches)
    expect(pointer.urls).toContain(ORIGIN + audioPath('A'))
    const reply = await sw.request(audioPath('A'), { destination: 'audio' })
    expect(reply.status).toBe(200)
    expect(reply.bytes).toEqual(AUDIO_BYTES)
    expect(reply.response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(reply.response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(reply.response.headers.get('Content-Length')).toBe(String(AUDIO_BYTES.length))
  })

  it.each([
    ['bytes=0-1', 0, 1], // Safari commonly checks the first two bytes.
    ['bytes=4-7', 4, 7],
    ['bytes=12-', 12, 15],
    ['bytes=-4', 12, 15],
    ['bytes=12-999999999999999999999999', 12, 15],
    ['bytes=-999999999999999999999999', 0, 15],
  ])('serves exact offline bytes for %s', async (range, first, last) => {
    const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: range } })
    expect(reply.status).toBe(206)
    expect(reply.bytes).toEqual(AUDIO_BYTES.slice(first, last + 1))
    expect(reply.response.headers.get('Content-Range')).toBe(`bytes ${first}-${last}/16`)
    expect(reply.response.headers.get('Content-Length')).toBe(String(last - first + 1))
    expect(reply.response.headers.get('Accept-Ranges')).toBe('bytes')
    // The range reply must not replace the full cached recording.
    expect((await sw.request(audioPath('A'), { destination: 'audio' })).bytes).toEqual(AUDIO_BYTES)
  })

  it.each(['bytes=16-', 'bytes=999999999999999999999999-', 'bytes=-0'])('returns 416 for unsatisfiable %s', async range => {
    const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: range } })
    expect(reply.status).toBe(416)
    expect(reply.bytes).toHaveLength(0)
    expect(reply.response.headers.get('Content-Range')).toBe('bytes */16')
  })

  it.each(['bytes=0-1,4-5', 'bytes=nope', 'bytes=8-3', 'bytes=-', 'items=0-1'])('ignores unsupported or malformed %s', async range => {
    const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: range } })
    expect(reply.status).toBe(200)
    expect(reply.bytes).toEqual(AUDIO_BYTES)
  })

  it('honors a matching strong If-Range and serves full bytes for other validators', async () => {
    for (const validator of ['W/"piano-v1"', '"other"', 'Sat, 26 Sep 2026 05:00:00 GMT']) {
      const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: 'bytes=0-1', 'If-Range': validator } })
      expect(reply.status).toBe(200)
      expect(reply.bytes).toEqual(AUDIO_BYTES)
    }
    const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: 'bytes=0-1', 'If-Range': '"piano-v1"' } })
    expect(reply.status).toBe(206)
    expect(reply.bytes).toEqual(AUDIO_BYTES.slice(0, 2))
  })

  it('removes stale encoding when constructing a partial response from decoded bytes', async () => {
    const pointer = await committed(caches)
    const cache = await caches.open(pointer.name)
    await cache.put(ORIGIN + audioPath('A'), new Response(AUDIO_BYTES, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Encoding': 'gzip' } }))
    const reply = await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: 'bytes=0-1' } })
    expect(reply.response.headers.has('Content-Encoding')).toBe(false)
    expect(reply.bytes).toEqual(AUDIO_BYTES.slice(0, 2))
  })

  it('never intercepts remote music, other audio, fetch/XHR, or asset URL queries', async () => {
    for (const request of [
      { url: 'https://youtube.com/audio.mp3', destination: 'audio' },
      { url: 'https://other.test' + audioPath('A'), destination: 'audio' },
      { url: ORIGIN + '/assets/some-other-audio.mp3', destination: 'audio' },
      { url: ORIGIN + audioPath('A') + '?private=1', destination: 'audio' },
      { url: ORIGIN + audioPath('A'), destination: '' },
    ]) expect((await sw.request('', request)).intercepted).toBe(false)
  })

  it('passes a network miss through unchanged without trying to cache partial audio', async () => {
    server.down = false
    const path = audioPath('notCommitted')
    server.files.set(ORIGIN + path, new Response(AUDIO_BYTES.slice(0, 2), { status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 0-1/16' } }))
    const reply = await sw.request(path, { destination: 'audio', headers: { Range: 'bytes=0-1' } })
    expect(reply.status).toBe(206)
    expect(server.lastInput.headers.get('Range')).toBe('bytes=0-1')
    expect(await caches.match(ORIGIN + path)).toBeUndefined()
  })
})

describe.each(['audio/mpeg', 'audio/mp3'])('bundled piano update failures (%s)', contentType => {
  it.each(['missing', 'partial', 'html', 'empty', 'content-range', 'quota'])('keeps the old complete shell after %s audio failure', async failure => {
    server.deploy(audioBuild('A'))
    const sw = loadWorker(caches, server)
    await sw.install()
    const previous = await committed(caches)
    const next = audioBuild('B')
    if (failure === 'missing') delete next[audioPath('B')]
    if (failure === 'partial') next[audioPath('B')] = new Response(AUDIO_BYTES.slice(0, 2), { status: 206, headers: { 'Content-Type': contentType } })
    if (failure === 'html') next[audioPath('B')] = new Response('<html>Fallback</html>', { headers: { 'Content-Type': 'text/html' } })
    if (failure === 'empty') next[audioPath('B')] = new Response(null, { headers: { 'Content-Type': contentType } })
    if (failure === 'content-range') next[audioPath('B')] = new Response(AUDIO_BYTES.slice(0, 2), { headers: { 'Content-Type': contentType, 'Content-Range': 'bytes 0-1/16' } })
    if (failure === 'quota') caches.faults.beforePut = (_name, url) => { if (url.endsWith(audioPath('B'))) throw new Error('Audio quota exceeded') }
    server.deploy(next)
    await expect(sw.install()).rejects.toThrow()
    expect(await committed(caches)).toEqual(previous)
    expect(await shellNames(caches)).toEqual([previous.name])
    server.down = true
    expect((await sw.request(audioPath('A'), { destination: 'audio', headers: { Range: 'bytes=0-1' } })).bytes).toEqual(AUDIO_BYTES.slice(0, 2))
  })
})

it.each(['audio/mp3evil', 'audio/mpeg3', 'application/octet-stream'])('rejects an unrelated or malformed audio MIME %s without replacing the shell', async contentType => {
  server.deploy(audioBuild('A'))
  const sw = loadWorker(caches, server)
  await sw.install()
  const previous = await committed(caches)
  server.deploy(audioBuild('B', contentType))
  await expect(sw.install()).rejects.toThrow('shell incomplete after download')
  expect(await committed(caches)).toEqual(previous)
  expect(await shellNames(caches)).toEqual([previous.name])
})

it.each(['audio/mpeg', 'audio/mp3', 'Audio/MP3; charset=binary'])('installs and activates a subpath shell with %s audio, then serves the app and piano range offline', async contentType => {
  const sub = makeServer()
  const buildFiles = audioBuild('sub', contentType)
  sub.files = new Map(Object.entries(buildFiles).map(([path, value]) => [
    `${ORIGIN}/moonrise${path}`,
    path === '/' ? value.replaceAll('"/', '"/moonrise/') : value,
  ]))
  const subCaches = new FakeCacheStorage(sub.fetch)
  const sw = loadWorker(subCaches, sub, `${ORIGIN}/moonrise/`)
  await sw.install()
  await sw.activate()
  sub.down = true
  const page = await sw.navigate('/moonrise/')
  expect(page.status).toBe(200)
  expect(page.text).toContain('/moonrise/assets/index-sub.js')
  const full = await sw.request(`/moonrise${audioPath('sub')}`, { destination: 'audio' })
  expect(full.status).toBe(200)
  expect(full.bytes).toEqual(AUDIO_BYTES)
  expect(full.response.headers.get('Content-Type')).toBe(contentType)
  const reply = await sw.request(`/moonrise${audioPath('sub')}`, { destination: 'audio', headers: { Range: 'bytes=2-6' } })
  expect(reply.status).toBe(206)
  expect(reply.bytes).toEqual(AUDIO_BYTES.slice(2, 7))
  expect(reply.response.headers.get('Content-Range')).toBe('bytes 2-6/16')
  expect(reply.response.headers.get('Content-Type')).toBe(contentType)
  expect((await sw.request(audioPath('sub'), { destination: 'audio' })).intercepted).toBe(false)
})
