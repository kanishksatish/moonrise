// Personal preferences and caregiver-entered events, never treatment advice.
// All IDs and times come from the caller. These helpers never read the clock,
// infer an observation, or infer acceptance from audio playback.
const ACTIVITIES = ['story', 'music', 'quiet']
const ACTIVITY_LABELS = { story: 'a familiar story', music: 'music', quiet: 'quiet company' }
const EVENT_TYPES = new Set(['offered', 'started', 'declined', 'stopped', 'observation', 'finished'])
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit).trim() : ''
}

function validId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function instant(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
  if (typeof value !== 'string' || !ISO_PATTERN.test(value) || !validDate(value.slice(0, 10))) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}

export function normalizeEveningPlan(raw) {
  const plan = record(raw)
  return {
    preferredName: text(plan.preferredName, 60),
    familiarPlace: text(plan.familiarPlace, 160),
    story: text(plan.story, 1200),
    caregiverCue: text(plan.caregiverCue, 400),
    avoid: text(plan.avoid, 300),
    photoId: validId(plan.photoId) ? plan.photoId : '',
    activities: Array.isArray(plan.activities)
      ? [...new Set(plan.activities.filter(activity => ACTIVITIES.includes(activity)))]
      : [...ACTIVITIES],
  }
}

function cleanEvent(raw) {
  const event = record(raw)
  if (!validId(event.id) || !EVENT_TYPES.has(event.type)) return null
  if (event.activity != null && !ACTIVITIES.includes(event.activity)) return null
  const source = event.source === undefined ? 'caregiver' : event.source
  if (source !== 'caregiver' && source !== 'player') return null
  if (source === 'player' && (event.activity !== 'music' || !['started', 'stopped'].includes(event.type))) return null
  if (event.text != null && typeof event.text !== 'string') return null
  const at = event.at == null ? null : instant(event.at)
  if (event.at != null && !at) return null
  return {
    id: event.id, type: event.type, source, activity: event.activity ?? null,
    at, text: text(event.text, 500),
  }
}

// Bad required identity/time/provenance rejects the session. Malformed optional
// event rows are omitted without discarding its other valid history. Missing
// events/plan are accepted for additive compatibility with older saved state.
export function cleanSession(raw) {
  try {
    const session = record(raw)
    const startedAt = instant(session.startedAt)
    if (!validId(session.id) || !validDate(session.date) || !startedAt
      || (session.isDemo !== undefined && typeof session.isDemo !== 'boolean')) return null
    const seen = new Set()
    const events = []
    for (const rawEvent of Array.isArray(session.events) ? session.events : []) {
      const event = cleanEvent(rawEvent)
      if (event && !seen.has(event.id)) {
        seen.add(event.id)
        events.push(event)
      }
    }
    const result = {
      id: session.id, date: session.date, startedAt,
      displayName: text(session.displayName, 60),
      plan: normalizeEveningPlan(session.plan), events, isDemo: session.isDemo === true,
    }
    if (typeof session.reviewedRevision === 'string') result.reviewedRevision = session.reviewedRevision
    const endedAt = instant(session.endedAt)
    if (endedAt) result.endedAt = endedAt
    return result
  } catch {
    return null
  }
}

export function createSession(profile, rawPlan, { id, now, date, isDemo = false } = {}) {
  if (!validId(id)) throw new TypeError('Provide a valid session id (1–120 letters, numbers, dots, colons, underscores or hyphens).')
  if (!validDate(date)) throw new TypeError('Provide a real evening date in YYYY-MM-DD form.')
  const startedAt = instant(now)
  if (!startedAt) throw new TypeError('Provide a valid session start time as a Date or an ISO timestamp with a time zone.')
  if (typeof isDemo !== 'boolean') throw new TypeError('isDemo must be true or false.')
  const plan = normalizeEveningPlan(rawPlan)
  return {
    id, date, startedAt, displayName: plan.preferredName || text(record(profile).name, 60),
    plan, events: [], isDemo,
  }
}

export function appendSessionEvent(session, rawEvent) {
  const current = cleanSession(session)
  if (!current) throw new TypeError('Provide a valid session before recording an event.')
  const event = cleanEvent(rawEvent)
  if (!event) throw new TypeError('Provide a valid event id, kind, optional activity and ISO time.')
  // First record wins. A repeated button/retry must not rewrite evidence or
  // invalidate review when nothing in the session changed.
  if (current.events.some(existing => existing.id === event.id)) return session
  const next = { ...current, events: [...current.events, event] }
  delete next.reviewedRevision
  if (event.type === 'finished' && event.at) next.endedAt = event.at
  return next
}

// Review is tied to exact normalized source content, not a length or weak hash.
// No review metadata participates in its own revision. Empty means invalid.
export function sessionRevision(session) {
  const current = cleanSession(session)
  if (!current) return ''
  const { id, plan, events, isDemo, displayName, date, startedAt, endedAt } = current
  return JSON.stringify({ id, plan, events, isDemo, displayName, date, startedAt, endedAt })
}

function eventStatement(event) {
  if (event.source === 'player') {
    return `${event.at ?? 'Time not recorded'} — The audio player reported playback ${event.type === 'started' ? 'starting' : 'stopping'}.`
  }
  const activity = event.activity ? ACTIVITY_LABELS[event.activity] : 'an activity (not recorded)'
  const statements = {
    offered: `Caregiver recorded offering ${activity}.`,
    started: `Caregiver recorded starting ${activity}.`,
    declined: `Caregiver marked ${activity} as declined.`,
    stopped: `Caregiver recorded stopping ${activity}.`,
    finished: event.activity ? `Caregiver recorded finishing ${activity}.` : 'Caregiver recorded the session as finished.',
    observation: event.text ? `Caregiver observation: “${event.text}”` : 'An observation entry was made; its text was not recorded.',
  }
  const note = event.text && event.type !== 'observation' ? ` Caregiver note: “${event.text}”` : ''
  return `${event.at ?? 'Time not recorded'} — ${statements[event.type]}${note}`
}

export function sessionHandoff(session) {
  const current = cleanSession(session)
  if (!current) return []
  const prefix = current.isDemo ? 'Example only. ' : ''
  const name = current.displayName ? ` for ${current.displayName}` : ' (display name not recorded)'
  const rows = [
    {
      id: `${current.id}:source`, eventIds: [],
      text: `${current.isDemo ? 'Fictional example, not a care record' : 'Evening session record'}${name}. Evening date: ${current.date}.`,
    },
    { id: `${current.id}:start`, eventIds: [], text: `${prefix}Session opened at ${current.startedAt}.` },
    ...current.events.map(event => ({
      id: `${current.id}:event:${event.id}`, text: `${prefix}${eventStatement(event)}`, eventIds: [event.id],
    })),
  ]
  if (!current.events.some(event => event.type === 'observation' && event.text)) {
    rows.push({
      id: `${current.id}:missing-observation`, eventIds: [],
      text: `${prefix}No observation entry with text was recorded. This does not mean there was no change.`,
    })
  }
  return rows
}
