import { describe, it, expect } from 'vitest'
import { songEvidence, evidenceText } from '../learning.js'
import { progress, realProgress } from '../progress.js'
import { generateDemoWeek } from '../demo.js'

const ev = (outcome, songIds = [], extra = {}) => ({ date: extra.date ?? '2026-09-20', outcome, songIds, ...extra })

describe('songEvidence', () => {
  it('counts evenings per song, by outcome, with the AGENTS.md score', () => {
    const logs = [ev('calm', ['a', 'b']), ev('restless', ['a']), ev('episode', ['a']), ev('calm', ['b'])]
    expect(songEvidence(logs)).toEqual({
      a: { plays: 3, calm: 1, restless: 1, episode: 1, score: 0 },
      b: { plays: 2, calm: 2, restless: 0, episode: 0, score: 2 },
    })
  })
  it('counts a song once per evening and ignores unknown outcomes', () => {
    const e = songEvidence([ev('calm', ['a', 'a']), ev('great', ['a']), ev('calm')])
    expect(e).toEqual({ a: { plays: 1, calm: 1, restless: 0, episode: 0, score: 1 } })
  })
  it('is empty without logs', () => {
    expect(songEvidence([])).toEqual({})
  })
})

describe('evidenceText', () => {
  it('describes counts plainly, with no claim about the song', () => {
    expect(evidenceText({ plays: 5, calm: 3, restless: 1, episode: 1 })).toBe(
      'Played in the app on 5 logged evenings: 3 calm, 1 restless, 1 episode.'
    )
    expect(evidenceText({ plays: 1, calm: 0, restless: 0, episode: 1 })).toBe('Played in the app on 1 logged evening: 1 episode.')
    expect(evidenceText({ plays: 2, calm: 0, restless: 0, episode: 2 })).toBe('Played in the app on 2 logged evenings: 2 episodes.')
    expect(evidenceText(undefined)).toBe('Not played in the app on a logged evening yet.')
    expect(evidenceText({ plays: 4, calm: 4, restless: 0, episode: 0 })).not.toMatch(/help|best|effective|%/i)
  })
})

describe('progress milestones (process only)', () => {
  const done = (ms) => ms.filter((m) => m.done).map((m) => m.id)

  it('has a fixed order and nothing done at first', () => {
    const ms = progress([])
    expect(ms.map((m) => m.id)).toEqual(['first-evening', 'first-song', 'start-from-logs', 'week'])
    expect(done(ms)).toEqual([])
  })

  it('never rewards outcomes: a calm evening and an episode evening unlock the same things', () => {
    expect(done(progress([ev('episode', ['a'])]))).toEqual(done(progress([ev('calm', ['a'])])))
    expect(done(progress([ev('calm', ['a'])]))).toEqual(['first-evening', 'first-song'])
  })

  it('has no milestone about calm outcomes or a particular song', () => {
    for (const m of progress([ev('calm', ['a'])])) {
      expect(`${m.title} ${m.detail}`).not.toMatch(/helpful|best song|calmer|worth trying|confident/i)
    }
  })

  it('bases the start time on logs only with 3 evenings and a timed episode', () => {
    const timed = { effectiveDusk: '2026-09-20T18:00:00.000Z', episodeStart: '2026-09-20T17:30:00.000Z' }
    const three = [ev('calm', [], { date: '2026-09-18' }), ev('calm', [], { date: '2026-09-19' }), ev('episode', [], { date: '2026-09-20', ...timed })]
    expect(done(progress(three.slice(0, 2)))).not.toContain('start-from-logs')
    const m = progress(three).find((x) => x.id === 'start-from-logs')
    expect(m.done).toBe(true)
    expect(m.detail).toMatch(/1 timed episode /)
  })

  it('flags partial progress that includes demo evenings', () => {
    const real = ev('calm', [], { date: '2026-09-26' })
    const demo = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'].map((date) => ev('calm', [], { date, demo: true }))
    const week = progress([real, ...demo]).find((m) => m.id === 'week')
    expect(week).toMatchObject({ current: 5, done: false, usesDemo: true })
    expect(realProgress([real, ...demo]).find((m) => m.id === 'week')).toMatchObject({ current: 1, usesDemo: false })
  })

  it('flags a finished milestone whose detail text changed because of demo evenings', () => {
    const t = (date, onsetIso, extra = {}) =>
      ev('episode', [], { date, effectiveDusk: `${date}T18:00:00.000Z`, episodeStart: onsetIso ?? `${date}T17:30:00.000Z`, ...extra })
    const realLogs = [t('2026-09-18'), t('2026-09-19'), t('2026-09-20')]
    const withDemo = [...realLogs, t('2026-09-21', null, { demo: true })]
    const m = progress(withDemo).find((x) => x.id === 'start-from-logs')
    expect(m.done).toBe(true)
    expect(m.detail).toMatch(/4 timed episodes/)
    expect(m.usesDemo).toBe(true)
    expect(progress(realLogs).find((x) => x.id === 'start-from-logs').usesDemo).toBe(false)
  })

  it('identifies milestones reached only through demo evenings', () => {
    const demo = generateDemoWeek({ birthYear: 1942, lat: 51.5, lon: -0.12, endDate: new Date(2026, 8, 25) })
    const week = progress(demo).find((m) => m.id === 'week')
    expect(week).toMatchObject({ done: true, usesDemo: true })
    const real = progress([ev('calm', [], { date: '2026-09-26' })]).find((m) => m.id === 'first-evening')
    expect(real).toMatchObject({ done: true, usesDemo: false })
  })
})
