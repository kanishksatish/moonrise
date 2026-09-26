import { describe, it, expect } from 'vitest'
import { familyCalmRate, songStats, untriedSong, startRange, SONG_PRIOR_STRENGTH } from '../learning.js'
import { progress } from '../progress.js'
import { generateDemoWeek } from '../demo.js'

const ev = (outcome, songIds = [], extra = {}) => ({ date: extra.date ?? '2026-09-20', outcome, songIds, ...extra })

describe('familyCalmRate', () => {
  it('starts at 0.5 and follows the logs (restless counts half)', () => {
    expect(familyCalmRate([])).toBe(0.5)
    // (0.5 + 1 + 1 + 0.5 + 0) / 5 = 0.6
    expect(familyCalmRate([ev('calm'), ev('calm'), ev('restless'), ev('episode')])).toBeCloseTo(0.6)
  })
})

describe('songStats', () => {
  it('starts every song at the family calm rate', () => {
    const logs = [ev('calm'), ev('episode')]
    expect(untriedSong(logs)).toMatchObject({ plays: 0, status: 'untried', calmRate: familyCalmRate(logs) })
  })

  it('uses a Beta prior worth 4 evenings (posterior mean formula)', () => {
    const logs = [ev('calm', ['a']), ev('calm', ['a']), ev('episode', ['b'])]
    const p0 = familyCalmRate(logs) // (0.5 + 1 + 1 + 0) / 4 = 0.625
    const a = songStats(logs).a
    expect(a.calmRate).toBeCloseTo((SONG_PRIOR_STRENGTH * p0 + 2) / (SONG_PRIOR_STRENGTH + 2), 3)
    expect(a).toMatchObject({ plays: 2, calm: 2, episode: 0, score: 2 })
  })

  it('does not let one lucky night beat a song with a strong record', () => {
    const logs = [
      ev('calm', ['lucky']),
      ...Array.from({ length: 8 }, () => ev('calm', ['proven'])),
      ev('episode', ['proven']),
      ev('episode', ['proven']),
      ev('episode'),
      ev('episode'),
      ev('restless'),
    ]
    const s = songStats(logs)
    expect(s.proven.calmRate).toBeGreaterThan(s.lucky.calmRate)
    expect(s.lucky.score).toBe(1)
    expect(s.proven.score).toBe(6)
  })

  it('marks a song promising only when its range is above the family rate', () => {
    const calmWith = Array.from({ length: 6 }, () => ev('calm', ['star']))
    const others = Array.from({ length: 6 }, () => ev('episode', ['meh']))
    const s = songStats([...calmWith, ...others])
    expect(s.star.status).toBe('promising')
    expect(s.meh.status).toBe('unpromising')
    expect(s.star.low).toBeGreaterThan(s.star.familyRate)
    expect(songStats([ev('calm', ['once']), ev('episode')]).once.status).toBe('learning')
  })

  it('counts a song once per evening and ignores unknown outcomes', () => {
    const s = songStats([ev('calm', ['a', 'a']), { date: 'x', outcome: 'great', songIds: ['a'] }])
    expect(s.a.plays).toBe(1)
  })

  it('keeps the range inside 0..1 and around the mean', () => {
    for (const st of Object.values(songStats([ev('calm', ['a']), ev('episode', ['b'])]))) {
      expect(st.low).toBeGreaterThanOrEqual(0)
      expect(st.high).toBeLessThanOrEqual(1)
      expect(st.low).toBeLessThanOrEqual(st.calmRate)
      expect(st.calmRate).toBeLessThanOrEqual(st.high)
    }
  })
})

describe('startRange', () => {
  it('is centred on the median target', () => {
    expect(startRange([20, 30, 90]).median).toBe(30)
    expect(startRange([20, 30]).median).toBe(25)
  })
  it('has a wide default range with no evidence', () => {
    expect(startRange([])).toMatchObject({ median: null, n: 0 })
    expect(startRange([]).halfWidth).toBeCloseTo(22)
  })
  it('narrows with consistent evidence, widens with scattered evidence', () => {
    const consistent = startRange([50, 50, 50, 50, 50, 50])
    const scattered = startRange([10, 90, 20, 80, 30, 70])
    expect(consistent.halfWidth).toBeLessThan(scattered.halfWidth)
    expect(startRange(Array(12).fill(50)).halfWidth).toBeLessThan(consistent.halfWidth)
  })
  it('never collapses to zero width on one or two identical episodes', () => {
    expect(startRange([50]).halfWidth).toBeGreaterThan(10)
    expect(startRange([50, 50]).halfWidth).toBeGreaterThan(8)
  })
})

describe('progress milestones', () => {
  it('words the song milestone as worth trying, with its evidence', () => {
    const logs = [
      ...Array.from({ length: 6 }, (_, i) => ev('calm', ['moon-river-1961'], { date: `2026-09-0${i + 1}` })),
      ...Array.from({ length: 6 }, (_, i) => ev('episode', [], { date: `2026-09-1${i}` })),
    ]
    const m = progress(logs).find((x) => x.id === 'promising-song')
    expect(m.done).toBe(true)
    expect(m.title).toBe('A song worth trying again')
    expect(m.detail).toMatch(/^Moon River: opened on 6 evenings \(6 calm\)/)
    expect(m.detail).not.toMatch(/help/i)
  })

  const ids = (ms) => ms.filter((m) => m.done).map((m) => m.id)

  it('starts with nothing done, in a fixed order', () => {
    const ms = progress([])
    expect(ms.map((m) => m.id)).toEqual(['first-evening', 'first-song', 'start-adapting', 'promising-song', 'week', 'start-confident'])
    expect(ids(ms)).toEqual([])
  })

  it('counts an episode evening exactly like a calm one', () => {
    expect(ids(progress([ev('episode')]))).toEqual(['first-evening'])
    expect(ids(progress([ev('calm')]))).toEqual(['first-evening'])
  })

  it('unlocks adapting start time only with 3 evenings and a timed episode', () => {
    const base = { effectiveDusk: '2026-09-20T18:00:00.000Z' }
    const timed = { ...base, episodeStart: '2026-09-20T17:30:00.000Z' }
    const three = [ev('calm', [], { date: '2026-09-18' }), ev('calm', [], { date: '2026-09-19' }), ev('episode', [], { date: '2026-09-20', ...timed })]
    expect(ids(progress(three.slice(0, 2)))).not.toContain('start-adapting')
    expect(ids(progress(three))).toContain('start-adapting')
    expect(progress(three).find((m) => m.id === 'start-adapting').detail).toMatch(/1 timed episode/)
  })

  it('flags milestones reached only through demo data', () => {
    const demo = generateDemoWeek({ birthYear: 1942, lat: 51.5, lon: -0.12, endDate: new Date(2026, 8, 25) })
    const ms = progress(demo)
    const week = ms.find((m) => m.id === 'week')
    expect(week.done).toBe(true)
    expect(week.usesDemo).toBe(true)
    const real = progress([ev('calm', [], { date: '2026-09-26' })])
    expect(real.find((m) => m.id === 'first-evening').usesDemo).toBe(false)
  })
})
