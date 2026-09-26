import { describe, it, expect } from 'vitest'
import { weeklyReport, formatOnset } from '../report.js'

const songs = [
  { id: 's1', title: 'One', artist: 'X', year: 1960 },
  { id: 's2', title: 'Two', artist: 'X', year: 1960 },
  { id: 's3', title: 'Three', artist: 'X', year: 1960 },
  { id: 's4', title: 'Four', artist: 'X', year: 1960 },
  { id: 's5', title: 'Five', artist: 'X', year: 1960 },
  { id: 's6', title: 'Six', artist: 'X', year: 1960 },
]

function log(day, outcome, { onset = null, cloud = 0, songIds = [] } = {}) {
  const dusk = new Date(2026, 8, day, 19, 0)
  return {
    date: `2026-09-${String(day).padStart(2, '0')}`,
    outcome,
    effectiveDusk: dusk.toISOString(),
    episodeStart: onset === null ? null : new Date(dusk.getTime() + onset * 60000).toISOString(),
    cloudCover: cloud,
    songIds,
  }
}

const endDate = new Date(2026, 8, 26, 21, 0)
const logs = [
  log(18, 'episode', { onset: -90 }), // outside the week
  log(20, 'calm', { cloud: 10, songIds: ['s1', 's2'] }),
  log(21, 'episode', { onset: -30, cloud: 90, songIds: ['s3'] }),
  log(22, 'restless', { cloud: 60, songIds: ['s1'] }),
  log(23, 'episode', { onset: -10, cloud: 80, songIds: ['s2', 's3'] }),
  log(24, 'calm', { cloud: 20, songIds: ['s1', 's4', 's5', 's6'] }),
  log(25, 'episode', { onset: 5, cloud: null }),
  log(26, 'calm', { cloud: 0, songIds: ['s4'] }),
]

describe('formatOnset', () => {
  it('describes minutes relative to dusk', () => {
    expect(formatOnset(-25)).toBe('25 min before dusk')
    expect(formatOnset(10)).toBe('10 min after dusk')
    expect(formatOnset(0)).toBe('at dusk')
    expect(formatOnset(null)).toBe('unknown')
  })
})

describe('weeklyReport', () => {
  const r = weeklyReport(logs, { endDate, songs })

  it('covers the 7 days ending on endDate', () => {
    expect(r.from).toBe('2026-09-20')
    expect(r.to).toBe('2026-09-26')
    expect(r.evenings).toBe(7)
    expect(r.nights.map((n) => n.date)[0]).toBe('2026-09-20')
  })

  it('counts outcomes', () => {
    expect(r.counts).toEqual({ calm: 3, restless: 1, episode: 3 })
  })

  it('reports episode onset relative to dusk', () => {
    expect(r.onset.minutes).toEqual([-30, -10, 5])
    expect(r.onset.medianMinutes).toBe(-10)
    expect(r.onset.text).toBe('10 min before dusk')
  })

  it('splits cloudy and clear evenings, skipping unknown cloud', () => {
    expect(r.cloudy).toEqual({ evenings: 3, episodes: 2 })
    expect(r.clear).toEqual({ evenings: 3, episodes: 0 })
  })

  it('lists the top 5 songs by weekly score', () => {
    expect(r.topSongs).toHaveLength(5)
    // s1: calm, restless, calm = +2 (3 plays). s4: calm, calm = +2 (2 plays). s3: two episodes = -2.
    expect(r.topSongs.map((s) => s.id).slice(0, 2)).toEqual(['s1', 's4'])
    expect(r.topSongs.find((s) => s.id === 's3')).toBeUndefined()
    expect(r.topSongs[0]).toMatchObject({ score: 2, plays: 3 })
  })

  it('always includes the doctor note', () => {
    expect(r.doctorNote).toMatch(/doctor/)
    expect(r.doctorNote).toMatch(/pain, infection, or a medication/i)
  })

  it('handles an empty week', () => {
    const empty = weeklyReport([], { endDate, songs })
    expect(empty.evenings).toBe(0)
    expect(empty.onset.medianMinutes).toBeNull()
    expect(empty.topSongs).toEqual([])
    expect(empty.doctorNote).toBeTruthy()
  })
})

describe('weeklyReport default window', () => {
  it('ends on the latest logged evening', () => {
    const r = weeklyReport(logs, { songs })
    expect(r.to).toBe('2026-09-26')
    expect(r.evenings).toBe(7)
  })
})
