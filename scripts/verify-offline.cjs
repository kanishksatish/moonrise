// Offline (service worker) check against real production builds. Not part of `npm test`.
//
// Run from the repo root:  NODE_PATH=$(npm root -g) node scripts/verify-offline.cjs
// Needs: Playwright (global install is fine) with Chromium, and python3 for a static server.
//
// It builds the app twice (base "/" and base "/moonrise/") into a temp dir, then fakes a second
// deploy ("build B") by copying build A with renamed hashed assets and a different <title>.
// Offline is simulated by stopping the web server (Playwright's setOffline does not cut off
// the service worker's own requests, so it can't prove offline support).

const os = require('os')
const path = require('path')
const fs = require('fs')
const P = fs.mkdtempSync(path.join(os.tmpdir(), 'moonrise-offline-'))
{
  const { execSync } = require('child_process')
  execSync(`npx vite build --outDir ${P}/buildA --emptyOutDir`, { stdio: 'ignore' })
  execSync(`npx vite build --base /moonrise/ --outDir ${P}/buildSub --emptyOutDir`, { stdio: 'ignore' })
  // Build B: same app, new asset names (as a real rebuild would produce), new title.
  execSync(`cp -r ${P}/buildA ${P}/buildB`)
  let html = fs.readFileSync(`${P}/buildB/index.html`, 'utf8').replace('<title>Moonrise</title>', '<title>Moonrise B</title>')
  for (const f of fs.readdirSync(`${P}/buildB/assets`)) {
    const renamed = f.replace(/-([\w-]+)\.(js|css)$/, '-$1b.$2')
    fs.renameSync(`${P}/buildB/assets/${f}`, `${P}/buildB/assets/${renamed}`)
    html = html.replace(f, renamed)
  }
  fs.writeFileSync(`${P}/buildB/index.html`, html)
  // Build C: a bad deploy. New worker code (forces an update), new asset names, CSS file missing.
  execSync(`cp -r ${P}/buildB ${P}/buildC`)
  let htmlC = fs.readFileSync(`${P}/buildC/index.html`, 'utf8').replace('Moonrise B', 'Moonrise C')
  for (const f of fs.readdirSync(`${P}/buildC/assets`)) {
    const renamed = f.replace(/\.(js|css)$/, 'c.$1')
    fs.renameSync(`${P}/buildC/assets/${f}`, `${P}/buildC/assets/${renamed}`)
    htmlC = htmlC.replace(f, renamed)
    if (renamed.endsWith('.css')) fs.rmSync(`${P}/buildC/assets/${renamed}`)
  }
  fs.writeFileSync(`${P}/buildC/index.html`, htmlC)
  fs.appendFileSync(`${P}/buildC/sw.js`, '\n// build C\n')
}
const { chromium } = require('playwright')
const { execSync, spawn } = require('child_process')
fs.mkdirSync(`${P}/site`, { recursive: true })
fs.mkdirSync(`${P}/sub/moonrise`, { recursive: true })
const results = []
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
const deploy = (build, dir) => execSync(`rm -rf ${dir} && mkdir -p ${dir} && cp -r ${P}/${build}/. ${dir}/`)
// Static server that labels MP3s the way GitHub Pages does (audio/mp3, not audio/mpeg), so a
// content-type assumption in the service worker fails here instead of only on the live site.
const PAGES_LIKE_SERVER = [
  'import functools, http.server, sys',
  'class H(http.server.SimpleHTTPRequestHandler):',
  '    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".mp3": "audio/mp3", ".webmanifest": "application/manifest+json"}',
  '    def log_message(self, *a): pass',
  // Serve by path, not the process cwd: deploy() deletes and recreates the folder.
  'handler = functools.partial(H, directory=sys.argv[2])',
  'http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), handler).serve_forever()',
].join('\n')
const serve = (root, port) => spawn('python3', ['-c', PAGES_LIKE_SERVER, String(port), root], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shellCaches(page) {
  return page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('moonrise-shell-')))
}
async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await sleep(200)
  }
  return false
}
function watchFailures(page) {
  const failed = []
  page.on('requestfailed', (r) => {
    if (new URL(r.url()).hostname === '127.0.0.1') failed.push(r.url())
  })
  page.on('response', (r) => {
    if (new URL(r.url()).hostname === '127.0.0.1' && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
  })
  return failed
}

const servers = {}
function online(port, root) {
  servers[port] = serve(root, port)
  return sleep(600)
}
function offline(port) {
  servers[port].kill()
  return sleep(300)
}

async function scenario(browser, { base, port, dir, label, root }) {
  const origin = `http://127.0.0.1:${port}`
  const start = `${origin}${base}`
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const failed = watchFailures(page)

  // 1. First online load of build A registers the worker and caches the shell.
  await page.goto(start)
  await page.getByLabel('Their first name').waitFor()
  // Ready = a committed shell (pointer written last) with every one of its files present.
  const shellHasStart = async () =>
    page.evaluate(async (scope) => {
      const res = await caches.match(scope + '__moonrise_committed_shell__', { cacheName: 'moonrise-meta' })
      if (!res) return false
      const pointer = await res.json()
      for (const url of pointer.urls) if (!(await caches.match(url, { cacheName: pointer.name }))) return false
      const shells = (await caches.keys()).filter((k) => k.startsWith('moonrise-shell-'))
      return shells.length === 1 && shells[0] === pointer.name
    }, start)
  const cachedA = await waitFor(shellHasStart)
  const keysA = await shellCaches(page)
  check(`${label}: shell cached after one online load`, cachedA, keysA.join(','))
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  check(`${label}: worker scope matches base path`, scope === start, scope)
  const cachedFiles = await page.evaluate(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname), keysA[0])
  const needed = ['assets/', 'manifest.webmanifest', 'icon.svg'].every((n) => cachedFiles.some((f) => f.includes(n)))
  check(`${label}: shell holds start page + hashed JS/CSS + manifest + icon`, needed && cachedFiles.includes(base), cachedFiles.join(' '))

  // 2. Offline reload and offline navigation.
  await offline(port)
  await page.reload()
  const offlineOk = await page.getByLabel('Their first name').isVisible()
  const title = await page.title()
  check(`${label}: offline reload renders the app`, offlineOk, `title="${title}"`)
  await page.goto(start)
  check(`${label}: offline navigation to start URL renders the app`, await page.getByLabel('Their first name').isVisible())
  // Cross-origin API is not intercepted: the page's own fetch fails normally.
  const apiBypassed = await page.evaluate(async () => {
    try {
      await fetch('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=1&daily=sunset')
      return 'fetched'
    } catch (e) {
      return 'network error (not served from cache)'
    }
  })
  const foreign = await page.evaluate(async (origin) => {
    const out = []
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) if (!r.url.startsWith(origin)) out.push(r.url)
    return out
  }, origin)
  check(`${label}: nothing cross-origin in any cache`, foreign.length === 0, foreign.join(' '))
  const served = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.workerStart > 0)
  check(`${label}: offline page was served through the worker`, served)
  await online(port, root)

  if (label === 'root') {
    // 3. Deploy build B. Online load gets B; the new shell replaces A only once complete.
    deploy('buildB', dir)
    await page.goto(start)
    await page.getByLabel('Their first name').waitFor()
    check('update: online load serves build B', (await page.title()) === 'Moonrise B', await page.title())
    const swapped = await waitFor(async () => {
      const k = await shellCaches(page)
      return k.length === 1 && k[0] !== keysA[0] && (await shellHasStart())
    })
    check('update: new shell cached and old shell removed', swapped, (await shellCaches(page)).join(','))
    await offline(port)
    await page.reload()
    const bOk = await page.getByLabel('Their first name').isVisible()
    check('update: offline reload renders build B', bOk && (await page.title()) === 'Moonrise B', await page.title())
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).join(' '))
    check('update: offline page uses build B assets', scripts.includes('b.js'), scripts)
    await online(port, root)

    // 3b. A bad deploy (new worker + a missing asset) must not replace the last good shell.
    const committedBefore = await shellCaches(page)
    deploy('buildC', dir)
    // Trigger the update check and record what happens to the new worker.
    const attempt = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const seen = new Promise((resolve) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          w.addEventListener('statechange', () => {
            if (w.state === 'redundant' || w.state === 'installed' || w.state === 'activated') resolve(w.state)
          })
        })
        setTimeout(() => resolve('no update found'), 8000)
      })
      try {
        await reg.update()
      } catch (e) {
        // update() rejects when the new worker's install fails; the statechange tells us why.
      }
      return seen
    })
    check('bad deploy: new worker was tried and rejected (redundant)', attempt === 'redundant', attempt)
    const regState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      return { waiting: !!reg.waiting, installing: !!reg.installing, active: !!reg.active }
    })
    check('bad deploy: new worker install fails, old worker stays active', !regState.waiting && regState.active, JSON.stringify(regState))
    check('bad deploy: committed shell unchanged', JSON.stringify(await shellCaches(page)) === JSON.stringify(committedBefore), (await shellCaches(page)).join(','))
    await offline(port)
    await page.reload()
    check('bad deploy: offline reload still renders build B', (await page.getByLabel('Their first name').isVisible()) && (await page.title()) === 'Moonrise B', await page.title())
    await online(port, root)
    deploy('buildB', dir)

    // 4. Worker installed but no shell cached (e.g. the first caching failed).
    await page.evaluate(async () => Promise.all((await caches.keys()).map((k) => caches.delete(k))))
    await offline(port)
    const res = await page.goto(start)
    const body = await page.textContent('body')
    check('no shell yet: shows "connect once" page, not a browser error', res.status() === 503 && body.includes('one online visit'), `status ${res.status()}`)
    await online(port, root)
    // Going online again recovers and re-caches.
    await page.goto(start)
    await page.getByLabel('Their first name').waitFor()
    const recached = await waitFor(shellHasStart)
    check('no shell yet: next online load re-caches the shell', recached)
  }

  // The only expected failure is the deliberate 503 "connect once" page.
  const unexpected = failed.filter((f) => !f.startsWith('503 '))
  check(`${label}: no failed same-origin asset requests`, unexpected.length === 0, unexpected.join(', '))
  await ctx.close()
}

;(async () => {
  deploy('buildA', `${P}/site`)
  deploy('buildSub', `${P}/sub/moonrise`)
  await online(4180, `${P}/site`)
  await online(4181, `${P}/sub`)
  const browser = await chromium.launch()
  try {
    await scenario(browser, { base: '/', port: 4180, dir: `${P}/site`, label: 'root', root: `${P}/site` })
    await scenario(browser, { base: '/moonrise/', port: 4181, dir: `${P}/sub/moonrise`, label: 'base /moonrise/', root: `${P}/sub` })
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0])
  } finally {
    await browser.close()
    for (const s of Object.values(servers)) s.kill()
  }
  console.log(results.join('\n'))
  process.exitCode = results.some((r) => !r.startsWith('PASS')) ? 1 : 0
})()
