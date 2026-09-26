import { describe, it, expect } from 'vitest'
import * as engine from '../index.js'

// The UI imports only these. If this list changes, note it in STATUS.md.
const CONTRACT = [
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
]

describe('engine contract', () => {
  it('exports exactly the documented functions', () => {
    // AI_MODEL is a constant (the model id shown in Settings), not a function.
    expect(Object.keys(engine).sort()).toEqual([...CONTRACT, 'AI_MODEL'].sort())
    for (const name of CONTRACT) expect(typeof engine[name]).toBe('function')
    expect(typeof engine.AI_MODEL).toBe('string')
  })
})
