// App state in localStorage. Every read and write is wrapped in try/catch:
// private browsing, full storage or blocked site data must never crash the app.
//
// State shape: { profile: { name, birthYear, lat, lon, city, anchors: { hometown, spouse, job } } | null,
//                logs: Log[],   (Log shape is documented in schedule.js)
//                tonight?: { date: 'YYYY-MM-DD', songIds: string[] } }   songs played in tonight's session
// Unknown keys are kept as they are, so the UI can store small extras.

export const STORAGE_KEY = 'moonrise:v1'

export function emptyState() {
  return { profile: null, logs: [] }
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const OUTCOMES = new Set(['calm', 'restless', 'episode'])

function isValidIso(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

// One stored evening, cleaned up, or null if it can't be used (no valid date or outcome).
// Keeps extra fields (e.g. demo: true) and repairs the optional ones instead of dropping
// the whole evening, so an old or half-written entry never breaks learning or the report.
export function cleanLog(log) {
  if (!log || typeof log !== 'object' || Array.isArray(log)) return null
  if (typeof log.date !== 'string' || !DATE_PATTERN.test(log.date) || !OUTCOMES.has(log.outcome)) return null
  return {
    ...log,
    episodeStart: log.outcome === 'episode' && isValidIso(log.episodeStart) ? log.episodeStart : null,
    effectiveDusk: isValidIso(log.effectiveDusk) ? log.effectiveDusk : null,
    cloudCover: Number.isFinite(log.cloudCover) ? log.cloudCover : null,
    songIds: Array.isArray(log.songIds) ? log.songIds.filter((id) => typeof id === 'string') : [],
  }
}

// A profile the app can run on: needs a whole birth year and real coordinates.
// Anything else sends the caregiver back to Setup instead of showing NaN times.
function cleanProfile(profile) {
  if (!profile || typeof profile !== 'object') return null
  if (!Number.isInteger(profile.birthYear) || !Number.isFinite(profile.lat) || !Number.isFinite(profile.lon)) return null
  return profile
}

export function loadState(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyState()
    // One log per evening; if storage somehow holds two for a date, the later entry wins.
    const byDate = new Map()
    for (const log of Array.isArray(parsed.logs) ? parsed.logs : []) {
      const clean = cleanLog(log)
      if (clean) byDate.set(clean.date, clean)
    }
    return {
      ...parsed,
      profile: cleanProfile(parsed.profile),
      logs: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    }
  } catch {
    return emptyState()
  }
}

// Returns true if saved, false if storage is unavailable.
export function saveState(state, storage = defaultStorage()) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

// One log per evening: a new log for the same date replaces the old one. Returns a new state.
export function addLog(state, log) {
  const logs = state.logs.filter((l) => l.date !== log.date)
  logs.push(log)
  logs.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { ...state, logs }
}

// Adds demo logs, replacing any real or demo log on the same dates. Returns a new state.
export function addDemoLogs(state, demoLogs) {
  return demoLogs.reduce(addLog, state)
}

export function clearDemoLogs(state) {
  return { ...state, logs: state.logs.filter((l) => !l.demo) }
}
