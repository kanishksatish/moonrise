import { describe, it, expect } from 'vitest'
import { fetchJson } from '../net.js'
import { findCity, geocodeUrl } from '../geo.js'

const respond = (json) => async () => ({ ok: true, json: async () => json })
const hang = () => new Promise(() => {})
const down = async () => {
  throw new Error('offline')
}

describe('fetchJson', () => {
  it('returns parsed JSON', async () => {
    expect(await fetchJson('https://x.test', { fetchFn: respond({ a: 1 }) })).toEqual({ a: 1 })
  })
  it('rejects on HTTP errors', async () => {
    const fetchFn = async () => ({ ok: false, status: 503 })
    await expect(fetchJson('https://x.test', { fetchFn })).rejects.toThrow(/503/)
  })
  it('rejects and aborts on timeout', async () => {
    let signal
    const fetchFn = (url, opts) => {
      signal = opts.signal
      return hang()
    }
    await expect(fetchJson('https://x.test', { fetchFn, timeoutMs: 20 })).rejects.toThrow(/Timed out/)
    expect(signal.aborted).toBe(true)
  })
})

describe('findCity', () => {
  const dallas = {
    results: [{ name: 'Dallas', admin1: 'Texas', country: 'United States', latitude: 32.78, longitude: -96.8 }],
  }

  it('returns the best match with a readable label', async () => {
    expect(await findCity('Dallas', { fetchFn: respond(dallas) })).toEqual({
      lat: 32.78,
      lon: -96.8,
      city: 'Dallas, Texas, United States',
    })
  })
  it('asks for one English result and trims the name', async () => {
    let asked
    const fetchFn = async (url) => {
      asked = new URL(url)
      return { ok: true, json: async () => dallas }
    }
    await findCity('  Dallas  ', { fetchFn })
    expect(asked.searchParams.get('name')).toBe('Dallas')
    expect(asked.searchParams.get('count')).toBe('1')
    expect(geocodeUrl('São Paulo')).toContain('S%C3%A3o+Paulo')
  })
  it('returns null only for a blank name or a successful response with no matches', async () => {
    // Open-Meteo leaves out `results` entirely when nothing matches.
    expect(await findCity('Nowhereville', { fetchFn: respond({ generationtime_ms: 0.3 }) })).toBeNull()
    expect(await findCity('Nowhereville', { fetchFn: respond({ results: [] }) })).toBeNull()
    expect(await findCity('   ', { fetchFn: down })).toBeNull()
    expect(await findCity(null, { fetchFn: down })).toBeNull()
  })
  it('rejects malformed responses and results', async () => {
    const bad = [
      null,
      'nope',
      { results: 'Dallas' },
      { results: [null] },
      { results: [{ name: 'Dallas', latitude: 'x', longitude: -96.8 }] },
      { results: [{ name: 'Dallas', latitude: 32.7, longitude: Infinity }] },
      { results: [{ name: '  ', latitude: 32.7, longitude: -96.8 }] },
      { results: [{ latitude: 32.7, longitude: -96.8 }] },
    ]
    for (const json of bad) {
      await expect(findCity('Dallas', { fetchFn: respond(json) })).rejects.toThrow(/Malformed/)
    }
  })
  it('rejects on HTTP errors', async () => {
    await expect(findCity('Dallas', { fetchFn: async () => ({ ok: false, status: 500 }) })).rejects.toThrow(/500/)
  })
  it('aborts the request on timeout', async () => {
    let signal
    const fetchFn = (url, opts) => {
      signal = opts.signal
      return hang()
    }
    await expect(findCity('Dallas', { fetchFn, timeoutMs: 20 })).rejects.toThrow(/Timed out/)
    expect(signal.aborted).toBe(true)
  })
  it('skips the country part when missing', async () => {
    const r = await findCity('X', { fetchFn: respond({ results: [{ name: 'X', latitude: 1, longitude: 2 }] }) })
    expect(r.city).toBe('X')
  })
  it('rejects on network failure or timeout so the UI can say "no connection"', async () => {
    await expect(findCity('Dallas', { fetchFn: down })).rejects.toThrow()
    await expect(findCity('Dallas', { fetchFn: hang, timeoutMs: 20 })).rejects.toThrow(/Timed out/)
  })
})
