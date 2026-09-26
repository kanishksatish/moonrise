import { describe, it, expect } from 'vitest'
import { generateDemoWeek } from '../demo.js'
import { moonriseStart } from '../schedule.js'
import { weeklyReport } from '../report.js'
import { eraSongs } from '../songs.js'

const opts = { birthYear: 1942, lat: 51.5, lon: -0.12, endDate: new Date(2026, 8, 26, 9) }

describe('generateDemoWeek', () => {
  const week = generateDemoWeek(opts)

  it('makes 7 consecutive evenings ending on endDate, all marked demo', () => {
    expect(week).toHaveLength(7)
    expect(week[0].date).toBe('2026-09-20')
    expect(week[6].date).toBe('2026-09-26')
    expect(week.every((l) => l.demo === true)).toBe(true)
  })

  it('produces valid logs', () => {
    const eraIds = eraSongs(1942).map((s) => s.id)
    for (const l of week) {
      expect(['calm', 'restless', 'episode']).toContain(l.outcome)
      expect(l.cloudCover).toBeGreaterThanOrEqual(0)
      expect(l.cloudCover).toBeLessThanOrEqual(100)
      expect(Number.isNaN(new Date(l.effectiveDusk).getTime())).toBe(false)
      expect(l.songIds).toHaveLength(3)
      expect(l.songIds.every((id) => eraIds.includes(id))).toBe(true)
      expect(l.episodeStart === null).toBe(l.outcome !== 'episode')
    }
  })

  it('has at least 2 episodes starting before dusk', () => {
    const episodes = week.filter((l) => l.outcome === 'episode')
    expect(episodes.length).toBeGreaterThanOrEqual(2)
    for (const l of episodes) {
      const onset = (new Date(l.episodeStart) - new Date(l.effectiveDusk)) / 60000
      expect(onset).toBeGreaterThanOrEqual(-50)
      expect(onset).toBeLessThanOrEqual(-20)
    }
  })

  it('is repeatable for the same seed and differs for another', () => {
    expect(generateDemoWeek(opts)).toEqual(week)
    expect(generateDemoWeek({ ...opts, seed: 7 })).not.toEqual(week)
  })

  it('drives the real schedule and report', () => {
    const start = moonriseStart(new Date('2026-09-27T18:00:00Z'), week)
    expect(start.basis).toBe('learned')
    expect(start.minutesBeforeDusk).toBeGreaterThan(45)
    const report = weeklyReport(week)
    expect(report.evenings).toBe(7)
    expect(report.topSongs.length).toBeGreaterThan(0)
    expect(report.topSongs[0].score).toBeGreaterThan(0)
  })
})
