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
]

describe('engine contract', () => {
  it('exports exactly the documented functions', () => {
    expect(Object.keys(engine).sort()).toEqual([...CONTRACT].sort())
    for (const name of CONTRACT) expect(typeof engine[name]).toBe('function')
  })
})
