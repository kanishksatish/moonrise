import { describe, it, expect } from 'vitest'
import { median, onsetMinutes, moonriseStart } from '../schedule.js'

const dusk = new Date('2026-09-26T18:30:00Z')

// An evening log whose dusk was 18:30 UTC on the given day.
function log(day, outcome, onsetFromDusk = null) {
  const d = new Date(`2026-09-${day}T18:30:00Z`)
  return {
    date: `2026-09-${day}`,
    outcome,
    effectiveDusk: d.toISOString(),
    episodeStart: onsetFromDusk === null ? null : new Date(d.getTime() + onsetFromDusk * 60000).toISOString(),
    cloudCover: 0,
    songIds: [],
  }
}

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('onsetMinutes', () => {
  it('measures episode start relative to that evening dusk', () => {
    expect(onsetMinutes(log(20, 'episode', -10))).toBe(-10)
    expect(onsetMinutes(log(20, 'episode', 25))).toBe(25)
  })
  it('is null for non-episodes and untimed episodes', () => {
    expect(onsetMinutes(log(20, 'calm'))).toBeNull()
    expect(onsetMinutes(log(20, 'episode'))).toBeNull()
  })
})

describe('moonriseStart', () => {
  it('defaults to 45 minutes before dusk with no logs', () => {
    const r = moonriseStart(dusk, [])
    expect(r.basis).toBe('default')
    expect(r.minutesBeforeDusk).toBe(45)
    expect(r.start.toISOString()).toBe('2026-09-26T17:45:00.000Z')
  })

  it('keeps the default with fewer than 3 logged evenings', () => {
    const r = moonriseStart(dusk, [log(20, 'episode', -40), log(21, 'episode', -40)])
    expect(r.basis).toBe('default')
    expect(r.minutesBeforeDusk).toBe(45)
  })

  it('keeps the default when 3+ evenings have no timed episodes', () => {
    const r = moonriseStart(dusk, [log(20, 'calm'), log(21, 'restless'), log(22, 'episode')])
    expect(r.basis).toBe('default')
  })

  it('learns from the median onset minus a 20 minute buffer (AGENTS.md rule)', () => {
    // onsets -30, -10, +5 -> median -10 -> start 30 min before dusk
    const logs = [log(20, 'episode', -30), log(21, 'episode', -10), log(22, 'episode', 5), log(23, 'calm')]
    const r = moonriseStart(dusk, logs)
    expect(r.basis).toBe('learned')
    expect(r.episodesUsed).toBe(3)
    expect(r.minutesBeforeDusk).toBe(30)
    expect(r.start.toISOString()).toBe('2026-09-26T18:00:00.000Z')
  })

  it('counts calm evenings toward the 3-evening threshold', () => {
    const r = moonriseStart(dusk, [log(20, 'calm'), log(21, 'calm'), log(22, 'episode', -20)])
    expect(r.basis).toBe('learned')
    expect(r.minutesBeforeDusk).toBe(40)
  })

  it('clamps to no later than 15 minutes before dusk', () => {
    const logs = [log(20, 'episode', 60), log(21, 'episode', 60), log(22, 'episode', 60)]
    expect(moonriseStart(dusk, logs).minutesBeforeDusk).toBe(15)
  })

  it('clamps to no earlier than 90 minutes before dusk', () => {
    const logs = [log(20, 'episode', -120), log(21, 'episode', -120), log(22, 'episode', -120)]
    const r = moonriseStart(dusk, logs)
    expect(r.minutesBeforeDusk).toBe(90)
    expect(r.start.toISOString()).toBe('2026-09-26T17:00:00.000Z')
  })

  it('is not swung by one unusual night', () => {
    const steady = [log(20, 'episode', -20), log(21, 'episode', -20), log(22, 'episode', -20), log(23, 'episode', -20)]
    const withOutlier = [...steady, log(24, 'episode', -85)]
    const a = moonriseStart(dusk, steady).minutesBeforeDusk
    const b = moonriseStart(dusk, withOutlier).minutesBeforeDusk
    expect(Math.abs(b - a)).toBeLessThanOrEqual(3)
  })

  it('gives a range that narrows as consistent evidence builds up', () => {
    const few = moonriseStart(dusk, [log(20, 'episode', -30), log(21, 'episode', -30), log(22, 'calm')])
    const many = moonriseStart(dusk, Array.from({ length: 12 }, (_, i) => log(String(10 + i), 'episode', -30)))
    expect(few.halfWidthMinutes).toBeGreaterThan(many.halfWidthMinutes)
    expect(few.range.earliest < few.start && few.start < few.range.latest).toBe(true)
    expect(many.confidence).toBe('high')
  })

  it('reports the default honestly, with a wide range', () => {
    // no episodes: 1.1 * 20 = 22 min either side of 45 min before dusk
    const r = moonriseStart(dusk, [])
    expect(r.confidence).toBe('default')
    expect(r.halfWidthMinutes).toBe(22)
    expect(r.range.earliest.toISOString()).toBe('2026-09-26T17:23:00.000Z')
    expect(r.range.latest.toISOString()).toBe('2026-09-26T18:07:00.000Z')
  })

  it('keeps the range inside the 15..90 minute window', () => {
    const logs = [log(20, 'episode', 60), log(21, 'episode', 60), log(22, 'episode', 60)]
    const r = moonriseStart(dusk, logs)
    expect(r.minutesBeforeDusk).toBe(15)
    expect(r.range.latest.getTime()).toBeLessThanOrEqual(dusk.getTime() - 15 * 60000)
  })
})
