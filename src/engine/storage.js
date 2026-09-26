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

export function loadState(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      ...parsed,
      profile: parsed.profile ?? null,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
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
