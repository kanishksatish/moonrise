import { describe, expect, it } from 'vitest'
import {
  appendSessionEvent, cleanSession, createSession, normalizeEveningPlan,
  sessionHandoff, sessionRevision,
} from '../eveningSession.js'

const NOW = '2026-09-26T22:00:00.000Z'
const LATER = '2026-09-26T22:05:00.000Z'
const options = { id: 'session-1', now: NOW, date: '2026-09-26' }
const makeSession = () => createSession({ name: 'Jo' }, { activities: ['music', 'quiet'] }, options)
const add = (session, overrides = {}) => appendSessionEvent(session, {
  id: 'event-1', type: 'offered', activity: 'music', at: NOW, ...overrides,
})

describe('personal evening plan', () => {
  it('normalizes bounded preferences without inventing personal details', () => {
    expect(normalizeEveningPlan(null)).toEqual({
      preferredName: '', familiarPlace: '', story: '', caregiverCue: '', avoid: '', photoId: '',
      activities: ['story', 'music', 'quiet'],
    })
    const plan = normalizeEveningPlan({
      preferredName: '  Jo  ', familiarPlace: 'p'.repeat(200), story: 's'.repeat(1300),
      caregiverCue: 'c'.repeat(500), avoid: 'a'.repeat(400),
      activities: ['quiet', 'invalid', 'music', 'quiet', null], extra: 'discard',
    })
    expect(plan.preferredName).toBe('Jo')
    expect(plan.familiarPlace).toHaveLength(160)
    expect(plan.story).toHaveLength(1200)
    expect(plan.caregiverCue).toHaveLength(400)
    expect(plan.avoid).toHaveLength(300)
    expect(plan.activities).toEqual(['quiet', 'music'])
    expect(plan).not.toHaveProperty('extra')
    expect(normalizeEveningPlan({ preferredName: 'n'.repeat(70) }).preferredName).toHaveLength(60)
    expect(normalizeEveningPlan({ story: 123, avoid: { text: 'noise' } }).story).toBe('')
  })

  it('preserves an explicitly empty activity selection and does not interpret avoid text', () => {
    expect(normalizeEveningPlan({ activities: [] }).activities).toEqual([])
    expect(normalizeEveningPlan({ activities: ['unknown'] }).activities).toEqual([])
    expect(normalizeEveningPlan({ avoid: '  Music tonight  ', activities: ['music'] })).toMatchObject({
      avoid: 'Music tonight', activities: ['music'],
    })
  })

  it('accepts only a local photo id and keeps the original snapshot when the prepared photo changes', () => {
    for (const photoId of ['https://example.com/photo.jpg', 'data:image/jpeg;base64,AAAA', 'blob:photo/file', '../photo']) {
      expect(normalizeEveningPlan({ photoId }).photoId).toBe('')
    }
    const plan = { photoId: '4b8aaf3b-6ee9-44b7-94a5-a7560e733bcb' }
    const session = createSession({}, plan, options)
    plan.photoId = 'another-local-photo'
    expect(session.plan.photoId).toBe('4b8aaf3b-6ee9-44b7-94a5-a7560e733bcb')
    expect(cleanSession(session).plan.photoId).toBe(session.plan.photoId)
    expect(sessionRevision({ ...session, plan: { ...session.plan, photoId: plan.photoId } })).not.toBe(sessionRevision(session))
  })
})

describe('session identity and immutable evidence', () => {
  it('snapshots only the display name and normalized plan; all time and identity come from the caller', () => {
    const profile = { name: 'Joseph', city: 'Private city' }
    const plan = { preferredName: ' Jo ', activities: ['story'], story: 'The garden.' }
    const suppliedDate = new Date('2026-09-26T17:00:00-05:00')
    const session = createSession(profile, plan, { ...options, now: suppliedDate })
    profile.name = 'Changed'
    plan.story = 'Changed'
    plan.activities.push('music')
    suppliedDate.setUTCFullYear(2030)
    expect(session).toEqual({
      id: 'session-1', date: '2026-09-26', startedAt: NOW, displayName: 'Jo', isDemo: false,
      plan: { preferredName: 'Jo', familiarPlace: '', story: 'The garden.', caregiverCue: '', avoid: '', photoId: '', activities: ['story'] },
      events: [],
    })
    expect(createSession({ name: ' Joseph ' }, {}, options).displayName).toBe('Joseph')
    expect(createSession(null, null, options).displayName).toBe('')
  })

  it.each([
    { id: '' }, { id: 'invalid id' }, { id: 'x'.repeat(121) },
    { date: '2026-02-30' }, { date: '2026-2-01' },
    { now: undefined }, { now: '2026-09-26' }, { now: '2026-09-26T22:00:00' },
    { now: '2026-02-30T22:00:00Z' }, { now: new Date(NaN) }, { isDemo: 'true' },
  ])('rejects invalid required input %j', invalid => {
    expect(() => createSession({}, {}, { ...options, ...invalid })).toThrow(TypeError)
  })

  it('accepts a real leap day and canonicalizes explicit offset timestamps', () => {
    expect(createSession({}, {}, {
      id: 'leap', date: '2024-02-29', now: '2024-02-29T17:00:00-05:00',
    }).startedAt).toBe('2024-02-29T22:00:00.000Z')
  })

  it('appends independently cloned events without inventing missing time, activity, or observation', () => {
    const original = makeSession()
    Object.freeze(original.events)
    Object.freeze(original.plan.activities)
    Object.freeze(original.plan)
    Object.freeze(original)
    const next = appendSessionEvent(original, { id: 'unknown-time', type: 'observation' })
    expect(original.events).toEqual([])
    expect(next).not.toBe(original)
    expect(next.plan).not.toBe(original.plan)
    expect(next.events).toEqual([{
      id: 'unknown-time', type: 'observation', source: 'caregiver', activity: null, at: null, text: '',
    }])
  })

  it.each([
    { id: '' }, { type: 'improved' }, { activity: 'medication' },
    { at: 'not a time' }, { at: '2026-09-26T25:00:00Z' }, { text: 123 },
    { source: 'model' }, { source: null },
    { source: 'player', type: 'observation' }, { source: 'player', type: 'started', activity: 'quiet' },
  ])('rejects invalid event input %j', invalid => {
    expect(() => add(makeSession(), invalid)).toThrow(TypeError)
  })

  it('keeps the first event for a repeated id and retains review on an unchanged retry', () => {
    const first = add(makeSession())
    const reviewed = { ...first, reviewedRevision: sessionRevision(first) }
    expect(add(reviewed, { type: 'declined', at: LATER })).toBe(reviewed)
    expect(reviewed.events[0].type).toBe('offered')
  })

  it('invalidates review for new evidence and ties revision to exact source content', () => {
    const session = add(makeSession(), { type: 'observation', text: 'Looked toward the window.' })
    const revision = sessionRevision(session)
    const reviewed = { ...session, reviewedRevision: revision }
    expect(sessionRevision(reviewed)).toBe(revision)
    const next = add(reviewed, { id: 'event-2', type: 'stopped', at: LATER })
    expect(next).not.toHaveProperty('reviewedRevision')
    expect(sessionRevision(next)).not.toBe(revision)
    for (const changed of [
      { ...session, displayName: 'Another name' },
      { ...session, date: '2026-09-27' },
      { ...session, isDemo: true },
      { ...session, plan: { ...session.plan, avoid: 'Loud music' } },
      { ...session, events: [{ ...session.events[0], text: 'Asked for quiet.' }] },
    ]) expect(sessionRevision(changed)).not.toBe(revision)
  })

  it('records an end only when a finished event supplies its time', () => {
    expect(add(makeSession(), { type: 'finished', at: undefined })).not.toHaveProperty('endedAt')
    expect(add(makeSession(), { type: 'finished', at: LATER }).endedAt).toBe(LATER)
  })
})

describe('persisted session compatibility', () => {
  it('accepts a minimal older session, rejects invalid required records, and never throws', () => {
    const minimal = { id: 'old', date: '2026-09-26', startedAt: NOW }
    expect(cleanSession(minimal)).toMatchObject({ displayName: '', events: [], isDemo: false })
    for (const invalid of [null, [], {}, { ...minimal, date: '2026-02-30' }, { ...minimal, isDemo: 'false' }]) {
      expect(cleanSession(invalid)).toBeNull()
      expect(sessionHandoff(invalid)).toEqual([])
      expect(sessionRevision(invalid)).toBe('')
    }
    expect(cleanSession({ get id() { throw new Error('unreadable') } })).toBeNull()
  })

  it('retains valid history and exact review while removing malformed or duplicate rows', () => {
    const reviewedRevision = 'long exact revision:'.repeat(1000)
    const clean = cleanSession({
      ...makeSession(), reviewedRevision, endedAt: '2026-09-26T17:05:00-05:00',
      events: [
        { id: 'first', type: 'offered', activity: 'music', text: '  Familiar song  ' },
        { id: 'bad', type: 'diagnosed' },
        { id: 'first', type: 'declined' },
        { id: 'player', type: 'started', activity: 'music', source: 'player', at: LATER },
      ],
    })
    expect(clean.events.map(event => event.id)).toEqual(['first', 'player'])
    expect(clean.events[0]).toMatchObject({ type: 'offered', source: 'caregiver', at: null, text: 'Familiar song' })
    expect(clean.events[1].source).toBe('player')
    expect(clean.reviewedRevision).toBe(reviewedRevision)
    expect(clean.endedAt).toBe(LATER)
    expect(cleanSession({ ...clean, endedAt: 'invalid' })).not.toHaveProperty('endedAt')
  })
})

describe('traceable factual handoff', () => {
  it('does not treat planned, offered, or played activities as acceptance or an observation', () => {
    let session = add(makeSession())
    session = add(session, { id: 'playback', type: 'started', source: 'player', text: 'Playback started:track-1' })
    const rows = sessionHandoff(session)
    const offered = rows.find(row => row.eventIds.includes('event-1'))
    const played = rows.find(row => row.eventIds.includes('playback'))
    expect(offered.text).toContain('Caregiver recorded offering music.')
    expect(played.text).toContain('The audio player reported playback starting.')
    expect(played.text).not.toContain('Caregiver')
    expect(played.text).not.toContain('track-1')
    expect(rows.find(row => row.id.endsWith(':missing-observation'))).toMatchObject({ eventIds: [] })
    expect(rows.map(row => row.text).join(' ')).toContain('This does not mean there was no change.')
    expect(rows.map(row => row.text).join(' ')).not.toMatch(/improved|effective|accepted|calmer/i)
  })

  it('quotes only the actual caregiver observation with a direct source link and explicit missing timestamp', () => {
    const session = add(makeSession(), { type: 'observation', activity: null, at: undefined, text: '  Asked to sit by the window.  ' })
    const rows = sessionHandoff(session)
    expect(rows.find(row => row.eventIds.includes('event-1'))).toEqual({
      id: 'session-1:event:event-1', eventIds: ['event-1'],
      text: 'Time not recorded — Caregiver observation: “Asked to sit by the window.”',
    })
    expect(rows.some(row => row.id.endsWith(':missing-observation'))).toBe(false)
    const unknown = sessionHandoff(add(makeSession(), { activity: undefined, at: undefined }))
    expect(unknown.find(row => row.eventIds.includes('event-1')).text).toContain('an activity (not recorded)')
  })

  it('keeps an empty observation distinct from an observation with text', () => {
    const rows = sessionHandoff(add(makeSession(), { type: 'observation', text: ' ' }))
    expect(rows.find(row => row.eventIds.includes('event-1')).text).toContain('its text was not recorded')
    expect(rows.some(row => row.id.endsWith(':missing-observation'))).toBe(true)
  })

  it('labels all fictional rows and keeps demo provenance through append and storage cleaning', () => {
    const example = add(createSession({ name: 'Fictional Jo' }, {}, { ...options, isDemo: true }))
    expect(cleanSession(example).isDemo).toBe(true)
    const rows = sessionHandoff(example)
    expect(rows[0].text).toContain('Fictional example, not a care record')
    expect(rows.slice(1).every(row => row.text.startsWith('Example only. '))).toBe(true)
    expect(sessionHandoff(makeSession())[0].text).not.toContain('example')
    expect(rows.flatMap(row => row.eventIds)).toEqual(['event-1'])
  })
})
