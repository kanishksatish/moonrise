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
    const state = { profile: { name: 'Rose', birthYear: 1942 }, logs: [{ date: '2026-09-26', outcome: 'calm' }] }
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
