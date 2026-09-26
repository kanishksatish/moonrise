import { describe, expect, it } from 'vitest'
import { cleanCareContext, comfortStepsText, handoffCoverage, logsForHandoff } from '../careContext.js'

describe('caregiver handoff source and missingness', () => {
  const logs = [
    { date: '2026-09-20', outcome: 'calm' },
    { date: '2026-09-24', outcome: 'episode', careContext: { source: 'caregiver', comfortSteps: [] } },
    { date: '2026-09-25', outcome: 'episode', episodeStart: '2026-09-26T00:00:00Z', cloudCover: 70, careContext: { source: 'caregiver', comfortSteps: ['conversation'] } },
    { date: '2026-09-26', outcome: 'calm', demo: true, cloudCover: 30 },
    { date: '2026-09-10', outcome: 'calm' },
  ]
  it('separates sources before counting and represents every missing evening', () => {
    const real = logsForHandoff(logs)
    const coverage = handoffCoverage(real, '2026-09-20', '2026-09-26')
    expect(coverage).toMatchObject({ recorded: 3, unrecorded: 4, episodes: 2, onsetRecorded: 1, onsetMissing: 1, contextRecorded: 2, contextMissing: 1, weatherMissing: 2 })
    expect(coverage.nights).toHaveLength(7)
    expect(coverage.nights[6]).toEqual({ date: '2026-09-26', log: null })
    expect(logsForHandoff(logs, 'example')).toEqual([logs[3]])
  })
  it('does not confuse unrecorded context with a reported empty list', () => {
    expect(comfortStepsText(undefined)).toBe('Not recorded')
    expect(comfortStepsText({ source: 'caregiver', comfortSteps: [] })).toBe('None of the listed steps (reported)')
    expect(comfortStepsText({ source: 'caregiver', comfortSteps: ['stopped-session', 'quiet-company'] })).toBe('Quiet company, Stopped session')
    expect(comfortStepsText({ source: 'caregiver', comfortSteps: ['invalid'] })).toBe('Not recorded')
    expect(cleanCareContext({ source: 'caregiver', comfortSteps: [NaN] })).toBeUndefined()
  })
})
