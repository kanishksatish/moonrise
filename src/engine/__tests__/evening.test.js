import { describe, it, expect } from 'vitest'
import { eveningDate, episodeStartFromTime, localDateString } from '../evening.js'

describe('eveningDate', () => {
  it('is the same day in the afternoon and evening', () => {
    expect(localDateString(eveningDate(new Date(2026, 8, 26, 17, 0)))).toBe('2026-09-26')
    expect(localDateString(eveningDate(new Date(2026, 8, 26, 23, 59)))).toBe('2026-09-26')
  })
  it('counts after-midnight as the previous evening', () => {
    expect(localDateString(eveningDate(new Date(2026, 8, 27, 0, 30)))).toBe('2026-09-26')
    expect(localDateString(eveningDate(new Date(2026, 8, 27, 3, 59)))).toBe('2026-09-26')
  })
  it('rolls over at 4 AM', () => {
    expect(localDateString(eveningDate(new Date(2026, 8, 27, 4, 0)))).toBe('2026-09-27')
  })
  it('handles month and year boundaries', () => {
    expect(localDateString(eveningDate(new Date(2026, 9, 1, 1, 0)))).toBe('2026-09-30')
    expect(localDateString(eveningDate(new Date(2027, 0, 1, 2, 0)))).toBe('2026-12-31')
  })
  it('returns local noon', () => {
    expect(eveningDate(new Date(2026, 8, 27, 1, 0)).getHours()).toBe(12)
  })
})

describe('episodeStartFromTime', () => {
  const evening = new Date(2026, 8, 26, 12)
  it('puts evening times on the evening date', () => {
    expect(episodeStartFromTime(evening, '18:05')).toBe(new Date(2026, 8, 26, 18, 5).toISOString())
    expect(episodeStartFromTime(evening, '23:30')).toBe(new Date(2026, 8, 26, 23, 30).toISOString())
  })
  it('puts after-midnight times on the next day', () => {
    expect(episodeStartFromTime(evening, '00:15')).toBe(new Date(2026, 8, 27, 0, 15).toISOString())
  })
  it('rejects malformed times', () => {
    expect(() => episodeStartFromTime(evening, '')).toThrow()
    expect(() => episodeStartFromTime(evening, '25:00')).toThrow()
  })
})
