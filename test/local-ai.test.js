import { afterEach, describe, expect, it, vi } from 'vitest'
import { request } from 'node:http'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalAiServer, MODEL } from '../local-ai/server.mjs'

const KEY = 'sk-fictional-only-test-key-123456789'
const profile = { birthYear: 1942, anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'teacher' } }
const good = 'What flowers grew near your childhood home?'
const reply = prompts => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ prompts }) }] }] }), { headers: { 'Content-Type': 'application/json' } })
const servers = [], dirs = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })))
  await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
async function start(options = {}) {
  const server = createLocalAiServer(options)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  servers.push(server)
  const host = `127.0.0.1:${server.address().port}`, origin = `http://${host}`
  const send = (path, { method = 'POST', body = {}, headers = {}, raw } = {}) => new Promise((resolve, reject) => {
    const bytes = ['GET', 'HEAD'].includes(method) ? '' : raw ?? JSON.stringify(body)
    const req = request(`${origin}${path}`, { method, agent: false, headers: { Host: host, Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'X-Moonrise-Client': '1', 'Content-Type': 'application/json', ...headers } }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        let json; try { json = JSON.parse(text) } catch { /* static response */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json })
      })
    })
    req.on('error', reject); req.end(bytes)
  })
  return { server, send, origin }
}
const api = (server, path, options) => server.send(`/__moonrise/ai/${path}`, options)

it('configures a masked-session key without upstream calls, echo, cookies, CORS or caching; disconnect clears it', async () => {
  const fetchImpl = vi.fn(), server = await start({ fetchImpl })
  expect((await api(server, 'status')).json).toEqual({ gateway: 'moonrise-local-openai-v1', configured: false })
  const configured = await api(server, 'setup', { body: { apiKey: KEY } })
  expect(configured.json).toEqual({ configured: true })
  expect(configured.text).not.toContain(KEY)
  expect(configured.headers['cache-control']).toBe('no-store')
  expect(configured.headers['set-cookie']).toBeUndefined()
  expect(configured.headers['access-control-allow-origin']).toBeUndefined()
  expect(fetchImpl).not.toHaveBeenCalled()
  expect((await api(server, 'status')).json.configured).toBe(true)
  expect((await api(server, 'disconnect')).json).toEqual({ configured: false })
  expect((await api(server, 'generate', { body: { profile } })).json.error).toBe('no_key')
  const page = await server.send('/connect', { method: 'GET' })
  expect(page.text).toContain('type="password"')
  expect(page.text).not.toContain(KEY)
  expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'")
})

it.each([
  { Host: 'evil.test' }, { Host: 'localhost:4180' }, { Origin: 'http://evil.test' }, { Origin: 'null' },
  { Origin: '' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }, { 'X-Moonrise-Client': '' },
])('rejects unsafe host/origin/metadata before processing a key: %j', async headers => {
  const server = await start()
  expect((await api(server, 'setup', { headers, body: { apiKey: KEY } })).status).toBe(403)
  expect((await api(server, 'status')).json.configured).toBe(false)
})

it('rejects cross-site preflight, GET API calls, wrong types, oversized and malformed bodies', async () => {
  const server = await start()
  expect((await api(server, 'setup', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } })).status).toBe(403)
  expect((await api(server, 'status', { method: 'GET' })).status).toBe(405)
  expect((await api(server, 'setup', { headers: { 'Content-Type': 'text/plain' } })).status).toBe(415)
  expect((await api(server, 'setup', { raw: 'x'.repeat(5000) })).status).toBe(413)
  expect((await api(server, 'setup', { raw: '{' })).status).toBe(400)
  expect((await api(server, 'setup', { body: { apiKey: KEY, model: 'other' } })).status).toBe(400)
  expect((await api(server, 'setup', { body: { apiKey: 'bad' } })).status).toBe(400)
})

it('sends only the strict profile to a fixed, bounded stateless Responses request and cleans drafts', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(reply([good, good, 'Who died in your family?', '<script>hello</script>', 'Try this link https://evil.test.', 'Tell me about a favourite breakfast.']))
  const server = await start({ apiKey: KEY, fetchImpl })
  const result = await api(server, 'generate', { body: { profile } })
  expect(result.json).toEqual({ prompts: [good, 'Tell me about a favourite breakfast.'] })
  const [url, options] = fetchImpl.mock.calls[0], body = JSON.parse(options.body)
  expect(url).toBe('https://api.openai.com/v1/responses')
  expect(options.redirect).toBe('error')
  expect(options.headers.Authorization).toBe(`Bearer ${KEY}`)
  expect(body.model).toBe(MODEL); expect(body.store).toBe(false); expect(body.max_output_tokens).toBe(700)
  expect(body).not.toHaveProperty('tools'); expect(body).not.toHaveProperty('previous_response_id')
  expect(body.text.format.strict).toBe(true)
  expect(body.input).toContain('Dayton'); expect(body.input).toContain('1942')
  expect(options.body).not.toContain(KEY)
  expect(result.text).not.toContain(KEY)
  expect(result.json).not.toHaveProperty('approvedPrompts')
})

it.each([
  { ...profile, name: 'Private' }, { ...profile, lat: 32 }, { ...profile, logs: [] },
  { ...profile, anchors: { ...profile.anchors, city: 'Private' } },
  { ...profile, anchors: { job: 'x'.repeat(161) } },
  { ...profile, anchors: { job: 'two\nlines' } }, { birthYear: 1800 }, { birthYear: '1942' },
])('rejects non-allowlisted or malformed profile data without sending it: %j', async invalid => {
  const fetchImpl = vi.fn(), server = await start({ apiKey: KEY, fetchImpl })
  expect((await api(server, 'generate', { body: { profile: invalid } })).status).toBe(400)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it.each([401, 403, 429, 500])('does not echo upstream secret-bearing errors (%i)', async status => {
  const server = await start({ apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(new Response(`${KEY}: Private profile details`, { status })) })
  const result = await api(server, 'generate', { body: { profile } })
  expect(result.status).toBe(status === 403 ? 401 : status === 500 ? 502 : status)
  expect(result.text).not.toMatch(/sk-|Private/)
})

it('rejects incomplete, malformed, oversized and refusal output without drafts', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'incomplete', output: [] })))
    .mockResolvedValueOnce(new Response('not json'))
    .mockResolvedValueOnce(new Response('x'.repeat(70000)))
  const server = await start({ apiKey: KEY, fetchImpl })
  for (let i = 0; i < 3; i++) expect((await api(server, 'generate', { body: { profile } })).json).toEqual({ error: 'bad_output' })
  const refused = await start({ apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: KEY }] }] }))) })
  expect((await api(refused, 'generate', { body: { profile } })).json).toEqual({ error: 'refused' })
  const leaked = await start({ apiKey: KEY, fetchImpl: vi.fn().mockResolvedValue(reply([KEY])) })
  expect((await api(leaked, 'generate', { body: { profile } })).json).toEqual({ error: 'bad_output' })
})

it('permits only one generation at a time, prevents key swaps during it, and bounds attempts', async () => {
  let finish
  const fetchImpl = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(() => reply([good]))
  const server = await start({ apiKey: KEY, fetchImpl })
  const first = api(server, 'generate', { body: { profile } })
  await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce())
  expect((await api(server, 'generate', { body: { profile } })).json.error).toBe('busy')
  expect((await api(server, 'disconnect')).json.error).toBe('busy')
  finish(reply([good])); await first
  await api(server, 'generate', { body: { profile } }); await api(server, 'generate', { body: { profile } })
  expect((await api(server, 'generate', { body: { profile } })).status).toBe(429)
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

it('aborts a timed-out request and permits a later request', async () => {
  const fetchImpl = vi.fn().mockImplementationOnce((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error(KEY))))).mockImplementation(() => reply([good]))
  const server = await start({ apiKey: KEY, fetchImpl, timeoutMs: 20 })
  expect((await api(server, 'generate', { body: { profile } })).json).toEqual({ error: 'timeout' })
  expect((await api(server, 'generate', { body: { profile } })).json.prompts).toEqual([good])
})

it('serves only built files with native media ranges, never arbitrary paths or the key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moonrise-local-ai-')); dirs.push(dir)
  await mkdir(join(dir, 'assets'))
  await writeFile(join(dir, 'index.html'), '<h1>Moonrise</h1>')
  await writeFile(join(dir, 'assets', 'track.mp3'), '0123456789')
  await writeFile(join(dir, '.env'), KEY)
  const server = await start({ apiKey: KEY, distDir: dir })
  expect((await server.send('/', { method: 'GET' })).text).toBe('<h1>Moonrise</h1>')
  const range = await server.send('/assets/track.mp3', { method: 'GET', headers: { Range: 'bytes=2-4' } })
  expect(range.status).toBe(206); expect(range.text).toBe('234'); expect(range.headers['content-type']).toBe('audio/mpeg')
  for (const path of ['/.env', '/local-ai/server.mjs', '/assets/../.env', '/assets/%2e%2e/.env', '/?apiKey=secret']) {
    const response = await server.send(path, { method: 'GET' })
    expect(response.status).toBe(404); expect(response.text).not.toContain(KEY)
  }
})
