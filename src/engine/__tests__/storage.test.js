import { describe, it, expect } from 'vitest'
import { STORAGE_KEY, loadState, saveState, addLog, addDemoLogs, clearDemoLogs, emptyState } from '../storage.js'

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
  }
}

const brokenStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('quota')
  },
}

describe('loadState / saveState', () => {
  it('round-trips state', () => {
    const s = memoryStorage()
    const state = {
      profile: { name: 'Rose', birthYear: 1942, lat: 51.5, lon: -0.12 },
      logs: [
        { date: '2026-09-26', outcome: 'calm', episodeStart: null, effectiveDusk: '2026-09-26T17:49:00.000Z', cloudCover: 10, songIds: [] },
      ],
    }
    expect(saveState(state, s)).toBe(true)
    expect(loadState(s)).toEqual(state)
  })
  it('returns empty state when nothing is stored', () => {
    expect(loadState(memoryStorage())).toEqual(emptyState())
  })
  it('survives corrupt data', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, '{not json')
    expect(loadState(s)).toEqual(emptyState())
    s.setItem(STORAGE_KEY, JSON.stringify({ logs: 'nope' }))
    expect(loadState(s)).toEqual(emptyState())
  })
  it('never throws when storage is blocked or missing', () => {
    expect(loadState(brokenStorage)).toEqual(emptyState())
    expect(saveState(emptyState(), brokenStorage)).toBe(false)
    expect(loadState(null)).toEqual(emptyState())
    expect(saveState(emptyState(), null)).toBe(false)
  })
})

describe('log helpers', () => {
  const base = { profile: null, logs: [{ date: '2026-09-25', outcome: 'calm' }] }

  it('adds logs in date order and replaces the same evening', () => {
    let s = addLog(base, { date: '2026-09-24', outcome: 'episode' })
    s = addLog(s, { date: '2026-09-25', outcome: 'restless' })
    expect(s.logs).toEqual([
      { date: '2026-09-24', outcome: 'episode' },
      { date: '2026-09-25', outcome: 'restless' },
    ])
    expect(base.logs).toHaveLength(1) // not mutated
  })

  it('adds and clears demo logs', () => {
    const demo = [
      { date: '2026-09-20', outcome: 'calm', demo: true },
      { date: '2026-09-21', outcome: 'episode', demo: true },
    ]
    const withDemo = addDemoLogs(base, demo)
    expect(withDemo.logs).toHaveLength(3)
    expect(clearDemoLogs(withDemo).logs).toEqual(base.logs)
  })
})

describe('extra keys', () => {
  it('keeps extra keys such as tonight', () => {
    const s = memoryStorage()
    const state = { profile: null, logs: [], tonight: { date: '2026-09-26', songIds: ['a'] } }
    saveState(state, s)
    expect(loadState(s)).toEqual(state)
  })
})

describe('loading damaged or old data', () => {
  const profile = { name: 'Rose', birthYear: 1942, lat: 51.5, lon: -0.12 }
  const good = { date: '2026-09-25', outcome: 'calm', episodeStart: null, effectiveDusk: '2026-09-25T17:50:00.000Z', cloudCover: 20, songIds: ['a'] }
  const load = (value) => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
    return loadState(s)
  }

  it('keeps valid logs untouched', () => {
    expect(load({ profile, logs: [good] }).logs).toEqual([good])
  })
  it('drops logs without a valid date or outcome', () => {
    const logs = [good, null, 'x', [], { date: 'yesterday', outcome: 'calm' }, { date: '2026-09-24', outcome: 'great' }, { outcome: 'calm' }]
    expect(load({ profile, logs }).logs).toEqual([good])
  })
  it('repairs optional fields instead of dropping the evening', () => {
    const [log] = load({
      profile,
      logs: [{ date: '2026-09-24', outcome: 'episode', episodeStart: 'soon', effectiveDusk: 42, cloudCover: 'lots', songIds: ['a', 7, null], demo: true }],
    }).logs
    expect(log).toEqual({ date: '2026-09-24', outcome: 'episode', episodeStart: null, effectiveDusk: null, cloudCover: null, songIds: ['a'], demo: true })
  })
  it('clears episodeStart on non-episode evenings', () => {
    const [log] = load({ profile, logs: [{ ...good, episodeStart: '2026-09-25T18:00:00.000Z' }] }).logs
    expect(log.episodeStart).toBeNull()
  })
  it('keeps one log per evening (last wins) in date order', () => {
    const logs = [{ ...good, date: '2026-09-26' }, good, { ...good, outcome: 'episode' }]
    expect(load({ profile, logs }).logs.map((l) => [l.date, l.outcome])).toEqual([
      ['2026-09-25', 'episode'],
      ['2026-09-26', 'calm'],
    ])
  })
  it('sends an unusable profile back to Setup', () => {
    expect(load({ profile: { ...profile, lat: 'x' }, logs: [] }).profile).toBeNull()
    expect(load({ profile: { ...profile, birthYear: '1942' }, logs: [] }).profile).toBeNull()
    expect(load({ profile, logs: [] }).profile).toEqual(profile)
  })
  it('treats non-object JSON as empty state', () => {
    expect(load('[1,2]')).toEqual(emptyState())
    expect(load('5')).toEqual(emptyState())
    expect(load('null')).toEqual(emptyState())
  })
})
