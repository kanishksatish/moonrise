process.env.TZ = 'America/Chicago'
import { describe, expect, it } from 'vitest'
import { makeEveningLog } from '../eveningLog.js'

const profile = { lat: 32.78, lon: -96.8 }
const sky = { ...profile, date: '2026-09-26', effectiveDusk: new Date(2026, 8, 26, 19, 15), cloudCover: 15 }
const state = { profile, logs: [], tonight: { date: '2026-09-26', songIds: ['old-song'] } }
const midnight = new Date(2026, 8, 27, 0, 30)

describe('saving an evening from the UI', () => {
  it('keeps the preceding evening, dusk, and songs when logging at 00:30', () => {
    expect(makeEveningLog(state, sky, 'episode', '23:30', midnight)).toEqual({
      date: '2026-09-26', outcome: 'episode', episodeStart: '2026-09-27T04:30:00.000Z',
      effectiveDusk: sky.effectiveDusk.toISOString(), cloudCover: 15, songIds: ['old-song'],
    })
  })
  it('supports an onset after midnight, but rejects future and invalid times', () => {
    expect(makeEveningLog(state, sky, 'episode', '00:15', midnight).episodeStart).toBe('2026-09-27T05:15:00.000Z')
    expect(() => makeEveningLog(state, sky, 'episode', '00:45', midnight)).toThrow(/future/)
    expect(() => makeEveningLog(state, sky, 'episode', '', midnight)).toThrow(/valid time/)
    expect(makeEveningLog(state, sky, 'episode', undefined, midnight).episodeStart).toBeNull()
  })
  it('refuses to mix a new evening or location with a stale sky result', () => {
    expect(() => makeEveningLog(state, sky, 'calm', undefined, new Date(2026, 8, 27, 4))).toThrow(/refresh/)
    expect(() => makeEveningLog({ ...state, profile: { lat: 51, lon: 0 } }, sky, 'calm', undefined, midnight)).toThrow(/refresh/)
  })
  it('retains songs on an edited log without importing another evening’s session', () => {
    const edited = { ...state, logs: [{ date: sky.date, songIds: ['saved-song'] }], tonight: { date: '2026-09-25', songIds: ['wrong-evening'] } }
    expect(makeEveningLog(edited, sky, 'restless', undefined, midnight).songIds).toEqual(['saved-song'])
  })

  it('retains caregiver context and a saved onset unless explicitly changed', () => {
    const careContext = { source: 'caregiver', comfortSteps: ['familiar-music', 'lowered-stimulation'] }
    const existing = { date: sky.date, outcome: 'episode', episodeStart: '2026-09-27T04:30:00.000Z', careContext, songIds: [] }
    const edited = { ...state, logs: [existing] }
    expect(makeEveningLog(edited, sky, 'episode', undefined, midnight)).toMatchObject({ careContext, episodeStart: existing.episodeStart })
    expect(makeEveningLog(edited, sky, 'episode', '00:15', midnight)).toMatchObject({ careContext, episodeStart: '2026-09-27T05:15:00.000Z' })
    expect(makeEveningLog(edited, sky, 'calm', undefined, midnight)).toMatchObject({ careContext, episodeStart: null })
    expect(makeEveningLog(edited, sky, 'episode', null, midnight)).toMatchObject({ careContext, episodeStart: null })
    expect(makeEveningLog(edited, sky, 'episode', undefined, midnight, { source: 'caregiver', comfortSteps: [] })).toMatchObject({ episodeStart: existing.episodeStart, careContext: { source: 'caregiver', comfortSteps: [] } })
  })

  it('never infers comfort steps from playback or inherits fictional observations', () => {
    expect(makeEveningLog(state, sky, 'calm', undefined, midnight)).not.toHaveProperty('careContext')
    const demo = { date: sky.date, outcome: 'episode', episodeStart: '2026-09-27T04:30:00.000Z', demo: true,
      careContext: { source: 'caregiver', comfortSteps: ['conversation'] }, songIds: ['example-song'] }
    expect(makeEveningLog({ ...state, tonight: null, logs: [demo] }, sky, 'episode', undefined, midnight)).toMatchObject({ episodeStart: null, songIds: [] })
    expect(makeEveningLog({ ...state, logs: [demo] }, sky, 'calm', undefined, midnight)).not.toHaveProperty('careContext')
  })
})
