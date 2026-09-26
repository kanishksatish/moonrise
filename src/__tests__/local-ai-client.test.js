import { expect, it, vi } from 'vitest'
import { generateLocalPrompts, isLocalAiOrigin, localAiStatus } from '../components/localAi.js'

it('never probes the gateway from Pages, HTTPS, localhost or other hosts', async () => {
  const fetchImpl = vi.fn()
  for (const url of ['https://kanishksatish.github.io/moonrise/', 'https://127.0.0.1/', 'http://localhost:4180/', 'http://evil.test/']) {
    expect(isLocalAiOrigin(new URL(url))).toBe(false)
    expect(await localAiStatus({ location: new URL(url), fetchImpl })).toBeNull()
  }
  expect(fetchImpl).not.toHaveBeenCalled()
})
it('accepts only the expected gateway status protocol', async () => {
  const location = new URL('http://127.0.0.1:4180/')
  expect(await localAiStatus({ location, fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ gateway: 'moonrise-local-openai-v1', configured: false }))) })).toEqual({ configured: false })
  expect(await localAiStatus({ location, fetchImpl: vi.fn().mockResolvedValue(new Response('<html>Not a gateway</html>')) })).toBeNull()
})
it('sends only the four allowed profile answers, never name, coordinates, logs, prior drafts or keys', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompts: ['A gentle question?', 'Already approved.'] })))
  const result = await generateLocalPrompts({ name: 'Secret name', birthYear: 1942, lat: 32, lon: -96, city: 'Private city', logs: ['private'], apiKey: 'secret', anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'teacher', unknown: 'private' } }, { existing: ['Already approved.'], fetchImpl })
  expect(result).toEqual(['A gentle question?'])
  const [route, options] = fetchImpl.mock.calls[0]
  expect(route).toBe('/__moonrise/ai/generate')
  expect(options.cache).toBe('no-store')
  expect(JSON.parse(options.body)).toEqual({ profile: { birthYear: 1942, anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'teacher' } } })
})
it('maps unsafe backend errors to fixed text and rejects malformed drafts', async () => {
  await expect(generateLocalPrompts({ birthYear: 1942 }, { fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'secret-key-value' }), { status: 500 })) })).rejects.toThrow('The local AI connection had a problem.')
  await expect(generateLocalPrompts({ birthYear: 1942 }, { fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompts: ['valid', 44] }))) })).rejects.toThrow('could not be used')
})
