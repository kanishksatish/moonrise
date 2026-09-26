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
    // Missing optional profile text comes back as empty strings; everything saved is kept.
    expect(loadState(s)).toEqual({
      ...state,
      profile: { ...state.profile, city: '', anchors: { hometown: '', spouse: '', job: '' } },
    })
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

  it('does not overwrite a real observation when loading a demo week', () => {
    const real = { date: '2026-09-25', outcome: 'episode', careContext: { source: 'caregiver', comfortSteps: ['quiet-company'] } }
    const state = { profile: null, logs: [real] }
    const loaded = addDemoLogs(state, [
      { date: real.date, outcome: 'calm', demo: true },
      { date: '2026-09-24', outcome: 'restless' },
    ])
    expect(loaded.logs.find(log => log.date === real.date)).toEqual(real)
    expect(loaded.logs[0].demo).toBe(true)
    expect(clearDemoLogs(loaded).logs).toEqual([real])
  })

  it('preserves optional context on older outcome-only updates and never imports it from a demo', () => {
    const careContext = { source: 'caregiver', comfortSteps: ['conversation'] }
    const state = { profile: null, logs: [{ ...base.logs[0], careContext }] }
    expect(addLog(state, { date: '2026-09-25', outcome: 'episode' }).logs[0].careContext).toEqual(careContext)
    const example = { ...state, logs: [{ ...state.logs[0], demo: true }] }
    expect(addLog(example, { date: '2026-09-25', outcome: 'calm' }).logs[0].careContext).toBeUndefined()
    expect(addLog(state, { date: '2026-09-25', outcome: 'calm', careContext: { source: 'caregiver', comfortSteps: [] } }).logs[0].careContext.comfortSteps).toEqual([])
  })
})

describe('optional caregiver context compatibility', () => {
  const baseLog = { date: '2026-09-26', outcome: 'calm', episodeStart: null, effectiveDusk: null, cloudCover: null, songIds: [] }
  const roundTrip = log => {
    const storage = memoryStorage()
    saveState({ profile: null, logs: [log] }, storage)
    return loadState(storage).logs[0]
  }

  it('keeps legacy unrecorded context absent and round-trips an explicit report of none', () => {
    expect(roundTrip(baseLog)).toEqual(baseLog)
    const none = { ...baseLog, careContext: { source: 'caregiver', comfortSteps: [] } }
    expect(roundTrip(none)).toEqual(none)
  })

  it('keeps only the bounded known context shape and never turns invalid entries into none', () => {
    const careContext = { source: 'caregiver', comfortSteps: ['quiet-company', 'quiet-company', 'stopped-session'], extra: 'not stored' }
    expect(roundTrip({ ...baseLog, careContext }).careContext).toEqual({ source: 'caregiver', comfortSteps: ['quiet-company', 'stopped-session'] })
    for (const value of [null, 'music', [], { source: 'app', comfortSteps: [] }, { source: 'caregiver', comfortSteps: ['unknown'] }, { source: 'caregiver', comfortSteps: ['conversation', 2] }, { source: 'caregiver', comfortSteps: [Infinity] }]) {
      expect(roundTrip({ ...baseLog, careContext: value })).toEqual(baseLog)
    }
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
    expect(load({ profile, logs: [] }).profile).toMatchObject(profile)
  })
  it('treats non-object JSON as empty state', () => {
    expect(load('[1,2]')).toEqual(emptyState())
    expect(load('5')).toEqual(emptyState())
    expect(load('null')).toEqual(emptyState())
  })
})

describe('loading damaged data: dates, profile text and tonight', () => {
  const profile = { name: 'Rose', birthYear: 1942, lat: 51.5, lon: -0.12, city: 'London', anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'nurse' } }
  const log = (date) => ({ date, outcome: 'calm', episodeStart: null, effectiveDusk: null, cloudCover: null, songIds: [] })
  const load = (value) => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, JSON.stringify(value))
    return loadState(s)
  }

  it('rejects dates that are not on the calendar', () => {
    const logs = ['2026-99-99', '2026-02-30', '2026-13-01', '2026-00-10', '2026-09-26', '2028-02-29'].map(log)
    expect(load({ profile, logs }).logs.map((l) => l.date)).toEqual(['2026-09-26', '2028-02-29'])
  })

  it('keeps a valid profile exactly as it was', () => {
    expect(load({ profile, logs: [] }).profile).toEqual(profile)
  })

  it('sends a profile with a missing, blank or non-text name back to Setup', () => {
    for (const name of [undefined, '', '   ', { bad: true }, 42, ['Rose']]) {
      expect(load({ profile: { ...profile, name }, logs: [] }).profile).toBeNull()
    }
  })

  it('turns non-text city and anchors into empty strings, keeping valid ones', () => {
    const p = load({ profile: { ...profile, city: { x: 1 }, anchors: { hometown: 'Dayton', spouse: null, job: 7 } }, logs: [] }).profile
    expect(p.city).toBe('')
    expect(p.anchors).toEqual({ hometown: 'Dayton', spouse: '', job: '' })
    expect(load({ profile: { ...profile, anchors: 'nope' }, logs: [] }).profile.anchors).toEqual({ hometown: '', spouse: '', job: '' })
    const noAnchors = { ...profile }
    delete noAnchors.anchors
    delete noAnchors.city
    expect(load({ profile: noAnchors, logs: [] }).profile).toMatchObject({ city: '', anchors: { hometown: '', spouse: '', job: '' } })
  })

  it('repairs tonight.songIds and drops a tonight record without a real date', () => {
    expect(load({ profile, logs: [], tonight: { date: '2026-09-26', songIds: null } }).tonight).toEqual({ date: '2026-09-26', songIds: [] })
    expect(load({ profile, logs: [], tonight: { date: '2026-09-26', songIds: ['a', 3] } }).tonight).toEqual({ date: '2026-09-26', songIds: ['a'] })
    for (const tonight of [null, 'x', [], { songIds: ['a'] }, { date: '2026-99-99', songIds: [] }]) {
      expect('tonight' in load({ profile, logs: [], tonight })).toBe(false)
    }
  })

  it('keeps a valid tonight and demo flags untouched', () => {
    const tonight = { date: '2026-09-26', songIds: ['my-girl-1964'] }
    const demo = { ...log('2026-09-25'), demo: true }
    const state = load({ profile, logs: [demo], tonight })
    expect(state.tonight).toEqual(tonight)
    expect(state.logs).toEqual([demo])
  })
})
