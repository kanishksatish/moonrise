import { describe, it, expect } from 'vitest'
import * as engine from '../index.js'

// The UI imports only these. If this list changes, note it in STATUS.md.
const FUNCTIONS = [
  'effectiveDusk', 'computeEffectiveDusk', 'cloudShiftMinutes',
  'eveningDate', 'episodeStartFromTime', 'localDateString',
  'findCity',
  'moonriseStart', 'onsetMinutes',
  'eraYears', 'eraSongs', 'songScore', 'playlist', 'findSong', 'spotifySearchUrl', 'youtubeSearchUrl',
  'weeklyReport', 'formatOnset',
  'moonPhase', 'skyState', 'skyGradient',
  'memoryPrompts', 'promptAt',
  'generateDemoWeek',
  'loadState', 'saveState', 'addLog', 'addDemoLogs', 'clearDemoLogs', 'emptyState',
  'loadAiKey', 'saveAiKey', 'clearAiKey',
  'generateMemoryPrompts', 'AiPromptError',
  'songEvidence', 'evidenceText', 'progress', 'realProgress', 'songVideo',
  'cleanCareContext', 'comfortStepsText', 'logsForHandoff', 'handoffCoverage',
]
const CONSTANTS = ['AI_MODEL', 'CARE_PLAN_NOTE', 'COMFORT_STEPS']

describe('engine contract', () => {
  it('exports exactly the documented functions and constants', () => {
    expect(Object.keys(engine).sort()).toEqual([...FUNCTIONS, ...CONSTANTS].sort())
    for (const name of FUNCTIONS) expect(typeof engine[name]).toBe('function')
  })

  it('provides text constants and the five supported comfort-step choices', () => {
    for (const name of ['AI_MODEL', 'CARE_PLAN_NOTE']) {
      expect(typeof engine[name]).toBe('string')
      expect(engine[name].trim().length).toBeGreaterThan(0)
    }
    expect(Array.isArray(engine.COMFORT_STEPS)).toBe(true)
    expect(engine.COMFORT_STEPS.map(step => step.id)).toEqual([
      'familiar-music', 'conversation', 'quiet-company', 'lowered-stimulation', 'stopped-session',
    ])
    for (const step of engine.COMFORT_STEPS) {
      expect(Object.keys(step).sort()).toEqual(['id', 'label'])
      expect(typeof step.label).toBe('string')
      expect(step.label.trim().length).toBeGreaterThan(0)
    }
  })
})
