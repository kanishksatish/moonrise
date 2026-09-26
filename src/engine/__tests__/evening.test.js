// Runs in a daylight-saving timezone so DST transitions are really exercised.
// (Vitest runs each test file in its own process, so this does not leak into other files.)
process.env.TZ = 'America/Chicago'

import { describe, it, expect } from 'vitest'
import { eveningDate, episodeStartFromTime, localDateString } from '../evening.js'
import { effectiveDusk } from '../sky.js'
import { onsetMinutes } from '../schedule.js'

const evening = (now) => localDateString(eveningDate(now))

describe('test setup', () => {
  it('is in a DST-observing timezone', () => {
    // CDT (UTC-5) in September, CST (UTC-6) in December.
    expect(new Date(2026, 8, 26).getTimezoneOffset()).toBe(300)
    expect(new Date(2026, 11, 26).getTimezoneOffset()).toBe(360)
  })
})

describe('eveningDate', () => {
  it('keeps the same day at 23:59 and at 04:00', () => {
    expect(evening(new Date(2026, 8, 26, 23, 59))).toBe('2026-09-26')
    expect(evening(new Date(2026, 8, 27, 4, 0))).toBe('2026-09-27')
  })
  it('counts 00:00 and 03:59 as the previous evening', () => {
    expect(evening(new Date(2026, 8, 27, 0, 0))).toBe('2026-09-26')
    expect(evening(new Date(2026, 8, 27, 3, 59))).toBe('2026-09-26')
  })
  it('handles month and year rollover', () => {
    expect(evening(new Date(2026, 9, 1, 1, 0))).toBe('2026-09-30')
    expect(evening(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31')
  })
  it('handles DST changes (spring forward 2026-03-08, fall back 2026-11-01)', () => {
    expect(evening(new Date(2026, 2, 8, 3, 30))).toBe('2026-03-07')
    expect(evening(new Date(2026, 10, 1, 1, 30))).toBe('2026-10-31')
    const fallBack = eveningDate(new Date(2026, 10, 1, 1, 30))
    expect(fallBack.getHours()).toBe(12)
  })
  it('returns a new Date at local noon and does not mutate the input', () => {
    const now = new Date(2026, 8, 27, 0, 30)
    const before = now.getTime()
    const e = eveningDate(now)
    expect(e).not.toBe(now)
    expect(now.getTime()).toBe(before)
    expect([e.getHours(), e.getMinutes()]).toEqual([12, 0])
  })
  it('returns null for an invalid date', () => {
    expect(eveningDate(new Date('nope'))).toBeNull()
  })
})

describe('episodeStartFromTime', () => {
  const sep26 = new Date(2026, 8, 26, 12)

  it('puts 23:59 on the evening date and 00:00..03:59 on the next day', () => {
    expect(episodeStartFromTime(sep26, '23:59')).toBe(new Date(2026, 8, 26, 23, 59).toISOString())
    expect(episodeStartFromTime(sep26, '00:00')).toBe(new Date(2026, 8, 27, 0, 0).toISOString())
    expect(episodeStartFromTime(sep26, '03:59')).toBe(new Date(2026, 8, 27, 3, 59).toISOString())
  })
  it('puts 04:00 on the evening date itself', () => {
    expect(episodeStartFromTime(sep26, '04:00')).toBe(new Date(2026, 8, 26, 4, 0).toISOString())
  })
  it('rolls over month and year ends', () => {
    expect(episodeStartFromTime(new Date(2026, 8, 30, 12), '00:30')).toBe(new Date(2026, 9, 1, 0, 30).toISOString())
    expect(episodeStartFromTime(new Date(2026, 11, 31, 12), '01:00')).toBe(new Date(2027, 0, 1, 1, 0).toISOString())
  })
  it('handles the fall-back night', () => {
    // 2026-11-01 00:30 CDT is still UTC-5.
    expect(episodeStartFromTime(new Date(2026, 9, 31, 12), '00:30')).toBe('2026-11-01T05:30:00.000Z')
  })
  it('returns null for a time skipped by spring forward', () => {
    // 02:00..02:59 on 2026-03-08 does not exist in Chicago.
    expect(episodeStartFromTime(new Date(2026, 2, 7, 12), '02:30')).toBeNull()
    expect(episodeStartFromTime(new Date(2026, 2, 7, 12), '03:30')).toBe('2026-03-08T08:30:00.000Z')
  })
  it('returns null for empty, malformed or out-of-range times and invalid evenings', () => {
    for (const t of ['', '7:30', '24:00', '12:60', '12:3', 'noon', null, undefined, 1830]) {
      expect(episodeStartFromTime(sep26, t)).toBeNull()
    }
    expect(episodeStartFromTime(new Date('nope'), '18:00')).toBeNull()
    expect(episodeStartFromTime(null, '18:00')).toBeNull()
  })
  it('does not mutate the evening', () => {
    const e = new Date(2026, 8, 26, 12)
    episodeStartFromTime(e, '01:00')
    expect(e.getTime()).toBe(new Date(2026, 8, 26, 12).getTime())
  })
})

describe('logging at 00:30 for an episode at 23:30', () => {
  it('keeps the previous evening date, its dusk, and a positive onset', async () => {
    const loggedAt = new Date(2026, 8, 27, 0, 30)
    const ev = eveningDate(loggedAt)
    const offline = async () => {
      throw new Error('offline')
    }
    const sky = await effectiveDusk(ev, 32.78, -96.8, { fetchFn: offline }) // Dallas
    const log = {
      date: localDateString(ev),
      outcome: 'episode',
      episodeStart: episodeStartFromTime(ev, '23:30'),
      effectiveDusk: sky.effectiveDusk.toISOString(),
    }
    expect(log.date).toBe('2026-09-26')
    expect(localDateString(sky.effectiveDusk)).toBe('2026-09-26')
    expect(log.episodeStart).toBe(new Date(2026, 8, 26, 23, 30).toISOString())
    const onset = onsetMinutes(log)
    // Dallas sunset is ~7:20 PM, so 23:30 is roughly 4 h 10 min after dusk.
    expect(onset).toBeGreaterThan(230)
    expect(onset).toBeLessThan(270)
  })
})
