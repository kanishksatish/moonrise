import { describe, it, expect } from 'vitest'
import { beforeEach } from 'vitest'
import {
  clearWeatherCache,
  cloudCoverBeforeSunset,
  cloudShiftMinutes,
  computeEffectiveDusk,
  effectiveDusk,
  localDateString,
  openMeteoUrl,
  parseOpenMeteo,
} from '../sky.js'

const MIN = 60 * 1000
const sunset = new Date('2026-09-26T18:47:00Z')
const hourAt = (iso, cloudCover) => ({ time: new Date(iso), cloudCover })

// Hourly samples around a sunset at 18:47 UTC. The 2h window is 16:47..18:47,
// so only the 17:00 and 18:00 samples count.
const hourly = [
  hourAt('2026-09-26T15:00:00Z', 0),
  hourAt('2026-09-26T16:00:00Z', 0),
  hourAt('2026-09-26T17:00:00Z', 80),
  hourAt('2026-09-26T18:00:00Z', 100),
  hourAt('2026-09-26T19:00:00Z', 0),
]

describe('cloudShiftMinutes', () => {
  it('is 0 for clear sky and 30 for full overcast', () => {
    expect(cloudShiftMinutes(0)).toBe(0)
    expect(cloudShiftMinutes(100)).toBe(30)
  })
  it('scales linearly and rounds to whole minutes', () => {
    expect(cloudShiftMinutes(50)).toBe(15)
    expect(cloudShiftMinutes(90)).toBe(27)
    expect(cloudShiftMinutes(33)).toBe(10) // 9.9 -> 10
  })
  it('clamps out-of-range values and treats unknown as no shift', () => {
    expect(cloudShiftMinutes(150)).toBe(30)
    expect(cloudShiftMinutes(-10)).toBe(0)
    expect(cloudShiftMinutes(null)).toBe(0)
    expect(cloudShiftMinutes(NaN)).toBe(0)
  })
})

describe('cloudCoverBeforeSunset', () => {
  it('averages only samples in the 2 hours before sunset', () => {
    expect(cloudCoverBeforeSunset(sunset, hourly)).toBe(90)
  })
  it('includes samples exactly on the window edges', () => {
    const edges = [
      { time: new Date(sunset.getTime() - 120 * MIN), cloudCover: 40 },
      { time: sunset, cloudCover: 60 },
    ]
    expect(cloudCoverBeforeSunset(sunset, edges)).toBe(50)
  })
  it('ignores missing values and returns null with no data', () => {
    expect(cloudCoverBeforeSunset(sunset, [hourAt('2026-09-26T18:00:00Z', null)])).toBeNull()
    expect(cloudCoverBeforeSunset(sunset, [])).toBeNull()
  })
})

describe('computeEffectiveDusk', () => {
  it('pulls dusk earlier on a cloudy evening', () => {
    const r = computeEffectiveDusk(sunset, hourly)
    expect(r.cloudCover).toBe(90)
    expect(r.shiftMinutes).toBe(27)
    expect(r.effectiveDusk.toISOString()).toBe('2026-09-26T18:20:00.000Z')
  })
  it('leaves dusk at sunset on a clear evening', () => {
    const clear = hourly.map((h) => ({ ...h, cloudCover: 0 }))
    expect(computeEffectiveDusk(sunset, clear).effectiveDusk).toEqual(sunset)
  })
  it('leaves dusk at sunset when cloud data is missing', () => {
    const r = computeEffectiveDusk(sunset, [])
    expect(r.cloudCover).toBeNull()
    expect(r.effectiveDusk).toEqual(sunset)
  })
})

describe('Open-Meteo helpers', () => {
  it('builds a single-day request with sunset and cloud cover', () => {
    const url = new URL(openMeteoUrl(new Date(2026, 8, 26, 9), 51.5, -0.12))
    expect(url.searchParams.get('daily')).toBe('sunset')
    expect(url.searchParams.get('hourly')).toBe('cloud_cover')
    expect(url.searchParams.get('start_date')).toBe('2026-09-26')
    expect(url.searchParams.get('end_date')).toBe('2026-09-26')
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
  })
  it('formats local dates with zero padding', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('parses unixtime responses', () => {
    const json = {
      daily: { sunset: [sunset.getTime() / 1000] },
      hourly: { time: [sunset.getTime() / 1000 - 3600], cloud_cover: [42] },
    }
    const parsed = parseOpenMeteo(json)
    expect(parsed.sunset).toEqual(sunset)
    expect(parsed.hourly[0].cloudCover).toBe(42)
  })
  it('throws when sunset is missing', () => {
    expect(() => parseOpenMeteo({ daily: {} })).toThrow()
  })
})

describe('effectiveDusk', () => {
  beforeEach(() => clearWeatherCache())
  const json = {
    daily: { sunset: [sunset.getTime() / 1000] },
    hourly: {
      time: hourly.map((h) => h.time.getTime() / 1000),
      cloud_cover: hourly.map((h) => h.cloudCover),
    },
  }

  it('uses Open-Meteo data when the fetch succeeds', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => json })
    const r = await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn })
    expect(r.source).toBe('open-meteo')
    expect(r.shiftMinutes).toBe(27)
    expect(r.effectiveDusk.toISOString()).toBe('2026-09-26T18:20:00.000Z')
  })

  it('falls back to SunCalc sunset with no shift when offline', async () => {
    const fetchFn = async () => {
      throw new Error('offline')
    }
    const r = await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn })
    expect(r.source).toBe('offline')
    expect(r.shiftMinutes).toBe(0)
    expect(r.effectiveDusk).toEqual(r.sunset)
    expect(r.sunset).toBeInstanceOf(Date)
    expect(Number.isNaN(r.sunset.getTime())).toBe(false)
  })

  it('falls back on a non-OK HTTP response', async () => {
    const fetchFn = async () => ({ ok: false, status: 500 })
    const r = await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn })
    expect(r.source).toBe('offline')
  })

  it('falls back when the weather request hangs', async () => {
    const fetchFn = () => new Promise(() => {}) // never resolves
    const r = await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn, timeoutMs: 20 })
    expect(r.source).toBe('offline')
    expect(r.effectiveDusk).toEqual(r.sunset)
  })

  it('falls back when the response body stalls', async () => {
    const fetchFn = async () => ({ ok: true, json: () => new Promise(() => {}) })
    const r = await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn, timeoutMs: 20 })
    expect(r.source).toBe('offline')
  })

  it('aborts the request on timeout', async () => {
    let signal
    const fetchFn = (url, opts) => {
      signal = opts.signal
      return new Promise(() => {})
    }
    await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn, timeoutMs: 20 })
    expect(signal.aborted).toBe(true)
  })

  it('keeps the last good weather when a later refresh fails', async () => {
    const day = new Date(2026, 8, 26)
    const ok = async () => ({ ok: true, json: async () => json })
    const down = async () => {
      throw new Error('offline')
    }
    await effectiveDusk(day, 51.5, -0.12, { fetchFn: ok })
    const r = await effectiveDusk(day, 51.5, -0.12, { fetchFn: down })
    expect(r.source).toBe('open-meteo')
    expect(r.cached).toBe(true)
    expect(r.shiftMinutes).toBe(27)
  })

  it('does not reuse weather from another day or place', async () => {
    const ok = async () => ({ ok: true, json: async () => json })
    const down = async () => {
      throw new Error('offline')
    }
    await effectiveDusk(new Date(2026, 8, 26), 51.5, -0.12, { fetchFn: ok })
    expect((await effectiveDusk(new Date(2026, 8, 27), 51.5, -0.12, { fetchFn: down })).source).toBe('offline')
    expect((await effectiveDusk(new Date(2026, 8, 26), 40.7, -74, { fetchFn: down })).source).toBe('offline')
  })
})
