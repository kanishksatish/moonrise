// App state in localStorage. Every read and write is wrapped in try/catch:
// private browsing, full storage or blocked site data must never crash the app.
//
// State shape: { profile: { name, birthYear, lat, lon, city, anchors: { hometown, spouse, job } } | null,
//                logs: Log[],   (Log shape is documented in schedule.js)
//                tonight?: { date: 'YYYY-MM-DD', songIds: string[] },   songs played in tonight's session
//                approvedPrompts?: string[] }   caregiver-approved extra memory prompts (see ai.js)
// Unknown keys are kept as they are, so the UI can store small extras.

import { cleanCareContext } from './careContext.js'
import { cleanSession, normalizeEveningPlan } from './eveningSession.js'

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

// A real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30, 2026-99-99 ...).
function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function cleanString(value) {
  return typeof value === 'string' ? value : ''
}

function cleanSongIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
}

// One stored evening, cleaned up, or null if it can't be used (no valid date or outcome).
// Keeps extra fields (e.g. demo: true) and repairs the optional ones instead of dropping
// the whole evening, so an old or half-written entry never breaks learning or the report.
export function cleanLog(log) {
  if (!log || typeof log !== 'object' || Array.isArray(log)) return null
  if (!isCalendarDate(log.date) || !OUTCOMES.has(log.outcome)) return null
  const cleaned = {
    ...log,
    episodeStart: log.outcome === 'episode' && isValidIso(log.episodeStart) ? log.episodeStart : null,
    effectiveDusk: isValidIso(log.effectiveDusk) ? log.effectiveDusk : null,
    cloudCover: Number.isFinite(log.cloudCover) ? log.cloudCover : null,
    songIds: cleanSongIds(log.songIds),
  }
  const context = cleanCareContext(log.careContext)
  if (context) cleaned.careContext = context
  else delete cleaned.careContext
  return cleaned
}

// A profile the app can run on: a name, a whole birth year and real coordinates.
// Anything else sends the caregiver back to Setup instead of showing NaN times or
// crashing on a non-text name. Text fields the UI shows are always strings.
function cleanProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null
  if (typeof profile.name !== 'string' || !profile.name.trim()) return null
  if (!Number.isInteger(profile.birthYear) || !Number.isFinite(profile.lat) || !Number.isFinite(profile.lon)) return null
  const anchors = profile.anchors && typeof profile.anchors === 'object' ? profile.anchors : {}
  return {
    ...profile,
    city: cleanString(profile.city),
    anchors: {
      ...anchors,
      hometown: cleanString(anchors.hometown),
      spouse: cleanString(anchors.spouse),
      job: cleanString(anchors.job),
    },
  }
}

// Tonight's session record ({ date, songIds }): kept only with a real date, songIds always
// an array of strings.
function cleanTonight(tonight) {
  if (!tonight || typeof tonight !== 'object' || Array.isArray(tonight) || !isCalendarDate(tonight.date)) return undefined
  return { ...tonight, songIds: cleanSongIds(tonight.songIds) }
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
    const state = {
      ...parsed,
      profile: cleanProfile(parsed.profile),
      logs: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    }
    if ('eveningPlan' in parsed) state.eveningPlan = normalizeEveningPlan(parsed.eveningPlan)
    if ('sessions' in parsed) state.sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : []).map(cleanSession).filter(Boolean)
    if ('approvedPrompts' in parsed) {
      state.approvedPrompts = Array.isArray(parsed.approvedPrompts)
        ? parsed.approvedPrompts.filter((t) => typeof t === 'string' && t.trim())
        : []
    }
    const tonight = cleanTonight(parsed.tonight)
    if (tonight) state.tonight = tonight
    else delete state.tonight
    return state
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
  const existing = state.logs.find(l => l.date === log.date)
  const next = { ...log }
  // Outcome/onset updates from older callers must not erase optional context.
  // A real observation replacing an example must never inherit example data.
  const context = cleanCareContext(Object.hasOwn(log, 'careContext') ? log.careContext
    : Boolean(existing?.demo) === Boolean(log.demo) ? existing?.careContext : undefined)
  if (context) next.careContext = context
  else delete next.careContext
  const logs = state.logs.filter((l) => l.date !== log.date)
  logs.push(next)
  logs.sort((a, b) => (a.date < b.date ? -1 : 1))
  return { ...state, logs }
}

// Refresh examples only on dates without a real observation.
export function addDemoLogs(state, demoLogs) {
  return demoLogs.reduce((current, log) => current.logs.some(saved => saved.date === log.date && !saved.demo)
    ? current : addLog(current, { ...log, demo: true }), state)
}

export function clearDemoLogs(state) {
  return { ...state, logs: state.logs.filter((l) => !l.demo), ...(Array.isArray(state.sessions) ? { sessions: state.sessions.filter(session => !session.isDemo) } : {}) }
}

// The optional Anthropic API key for AI prompts lives under its own key, never inside the
// app state, so it can't end up in a saved report, an export or a demo reset by accident.
export const AI_KEY_STORAGE_KEY = 'moonrise:ai-key'

export function loadAiKey(storage = defaultStorage()) {
  try {
    const key = storage?.getItem(AI_KEY_STORAGE_KEY)
    return typeof key === 'string' ? key : ''
  } catch {
    return ''
  }
}

export function saveAiKey(key, storage = defaultStorage()) {
  try {
    const clean = typeof key === 'string' ? key.trim() : ''
    if (clean) storage.setItem(AI_KEY_STORAGE_KEY, clean)
    else storage.removeItem(AI_KEY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function clearAiKey(storage = defaultStorage()) {
  return saveAiKey('', storage)
}
