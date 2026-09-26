// Optional caregiver-reported context. It is never inferred from playback or
// used to score a step, recommend care, or change the routine's timing.
export const COMFORT_STEPS = Object.freeze([
  { id: 'familiar-music', label: 'Familiar music' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'quiet-company', label: 'Quiet company' },
  { id: 'lowered-stimulation', label: 'Lowered stimulation' },
  { id: 'stopped-session', label: 'Stopped session' },
])

const STEP_IDS = new Set(COMFORT_STEPS.map(step => step.id))

// Absent/invalid means unrecorded. Only a valid, explicitly saved empty array
// means the caregiver reported none of these listed steps. Reject rather than
// filter invalid entries: an unknown value must never become a claim of none.
export function cleanCareContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.source !== 'caregiver' || !Array.isArray(value.comfortSteps)
    || !value.comfortSteps.every(step => STEP_IDS.has(step))) return undefined
  return { source: 'caregiver', comfortSteps: [...new Set(value.comfortSteps)] }
}

export function comfortStepsText(value) {
  const context = cleanCareContext(value)
  if (!context) return 'Not recorded'
  if (context.comfortSteps.length === 0) return 'None of the listed steps (reported)'
  return COMFORT_STEPS.filter(step => context.comfortSteps.includes(step.id))
    .map(step => step.label).join(', ')
}

export const CARE_PLAN_NOTE = 'Moonrise is not monitored. Follow the person’s care plan and contact their care team for new or concerning changes.'

// Reports select one source before calculating anything, so fictional examples
// cannot enter a recorded-care handoff's counts, timing or song activity.
export function logsForHandoff(logs, source = 'recorded') {
  return logs.filter(log => source === 'example' ? Boolean(log.demo) : !log.demo)
}

export function handoffCoverage(logs, from, to) {
  const week = logs.filter(log => log.date >= from && log.date <= to)
  const [year, month, day] = from.split('-').map(Number)
  const nights = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(year, month - 1, day + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return { date: key, log: week.find(log => log.date === key) ?? null }
  })
  const episodes = week.filter(log => log.outcome === 'episode')
  const onsetRecorded = episodes.filter(log => typeof log.episodeStart === 'string'
    && Number.isFinite(new Date(log.episodeStart).getTime())).length
  const contextRecorded = week.filter(log => cleanCareContext(log.careContext)).length
  return {
    nights, recorded: week.length, unrecorded: nights.filter(night => !night.log).length,
    episodes: episodes.length, onsetRecorded, onsetMissing: episodes.length - onsetRecorded,
    contextRecorded, contextMissing: week.length - contextRecorded,
    weatherMissing: week.filter(log => !Number.isFinite(log.cloudCover)).length,
  }
}
