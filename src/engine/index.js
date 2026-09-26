// Shared contract between engine and UI. UI imports only from here.
// Change only after noting it in STATUS.md.

export { effectiveDusk, computeEffectiveDusk, cloudShiftMinutes } from './sky.js'
export { eveningDate, episodeStartFromTime, localDateString } from './evening.js'
export { findCity } from './geo.js'
export { moonriseStart, onsetMinutes } from './schedule.js'
export {
  eraYears,
  eraSongs,
  songScore,
  playlist,
  findSong,
  spotifySearchUrl,
  youtubeSearchUrl,
} from './songs.js'
export { weeklyReport, formatOnset } from './report.js'
export { moonPhase, skyState, skyGradient } from './moon.js'
export { memoryPrompts, promptAt } from './prompts.js'
export { generateDemoWeek } from './demo.js'
export {
  loadState,
  saveState,
  addLog,
  addDemoLogs,
  clearDemoLogs,
  emptyState,
  loadAiKey,
  saveAiKey,
  clearAiKey,
} from './storage.js'
export { generateMemoryPrompts, AiPromptError, AI_MODEL } from './ai.js'
export { songEvidence, evidenceText } from './learning.js'
export { progress } from './progress.js'
