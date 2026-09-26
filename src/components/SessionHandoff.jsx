import { useId, useRef, useState } from 'react'
import { cleanSession, sessionHandoff, sessionRevision } from '../engine/eveningSession.js'
import '../styles/session-handoff.css'

const EVENT_TYPES = new Set(['offered', 'started', 'declined', 'stopped', 'observation', 'finished'])
const ACTIVITIES = new Set(['story', 'music', 'quiet'])
const ACTIVITY_LABELS = { story: 'Familiar story', music: 'Music', quiet: 'Quiet company' }
const EVENT_LABELS = { offered: 'Offered', started: 'Started', declined: 'Declined', stopped: 'Stopped', observation: 'Observation', finished: 'Finished' }
const string = value => typeof value === 'string' ? value : ''
const validTime = value => typeof value === 'string' && Number.isFinite(new Date(value).getTime())

function prepareSession(session) {
  if (!session || typeof session !== 'object' || typeof session.isDemo !== 'boolean'
    || !Array.isArray(session.events)) return null
  try {
    const clean = cleanSession(session)
    if (!clean) return null
    const lines = sessionHandoff(clean)
    if (!Array.isArray(lines) || !lines.length) return null
    const validLines = lines.filter(line => line && typeof line.id === 'string'
      && typeof line.text === 'string' && Array.isArray(line.eventIds))
    if (!validLines.length) return null
    const revision = sessionRevision(clean)
    return revision ? { ...clean, lines: validLines, revision } : null
  } catch {
    // Corrupt or newer records must not become a plausible-looking care record.
    return null
  }
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(at) {
  return validTime(at) ? new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Time not recorded'
}

function formatEventTime(at) {
  return validTime(at) ? new Date(at).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  }) : 'Time not recorded'
}

function displayLine(line, session) {
  // Reformat only the engine's known timestamp field, never dates inside a
  // caregiver's quoted observation. The stored source remains inspectable.
  if (line.id === `${session.id}:start`) return line.text.replace(session.startedAt, formatEventTime(session.startedAt))
  const event = session.events.find(entry => line.eventIds.includes(entry.id))
  const prefix = session.isDemo ? 'Example only. ' : ''
  return event?.at && line.text.startsWith(`${prefix}${event.at} — `)
    ? line.text.replace(event.at, formatEventTime(event.at)) : line.text
}

function SourceEvent({ eventId, events }) {
  const event = events.find(entry => entry && entry.id === eventId)
  return (
    <details className="session-handoff-source">
      <summary>View recorded action</summary>
      {event ? <dl>
        <div><dt>Source</dt><dd>{event.source === 'caregiver' ? 'Caregiver-entered' : event.source === 'player' ? 'Player-reported' : 'Source not recorded'}</dd></div>
        <div><dt>Action</dt><dd>{EVENT_TYPES.has(event.type) ? EVENT_LABELS[event.type] : 'Unknown action type'}</dd></div>
        <div><dt>Activity</dt><dd>{ACTIVITIES.has(event.activity) ? ACTIVITY_LABELS[event.activity] : 'Not recorded'}</dd></div>
        <div><dt>Recorded at</dt><dd>{validTime(event.at) ? <time dateTime={event.at}>{formatEventTime(event.at)}</time> : 'Time not recorded'}</dd></div>
        <div><dt>Original text</dt><dd>{string(event.text).trim() ? event.text : 'No text recorded'}</dd></div>
        <div><dt>Record ID</dt><dd>{eventId}</dd></div>
      </dl> : <p>The source action is unavailable. Do not treat this line as a verified record.</p>}
    </details>
  )
}

export default function SessionHandoff({ sessions = [], onReview, saveError = false, initialSessionId = null }) {
  const id = useId()
  const reviewStatus = useRef(null)
  const [source, setSource] = useState(() => (Array.isArray(sessions) ? sessions : []).find(session => session?.id === initialSessionId)?.isDemo ? 'fictional' : null)
  const [selectedId, setSelectedId] = useState(initialSessionId)
  const [reviewError, setReviewError] = useState(null)
  const prepared = (Array.isArray(sessions) ? sessions : [])
    .map(prepareSession).filter(Boolean)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
  const recorded = prepared.filter(session => !session.isDemo)
  const fictional = prepared.filter(session => session.isDemo)
  const activeSource = source === 'fictional' && fictional.length ? 'fictional'
    : source === 'recorded' && recorded.length ? 'recorded'
      : recorded.length ? 'recorded' : 'fictional'
  const available = activeSource === 'fictional' ? fictional : recorded
  const session = available.find(entry => entry.id === selectedId) ?? available[0]
  const reviewed = Boolean(session && session.reviewedRevision === session.revision)
  const example = session?.isDemo === true
  const currentError = reviewError && session && reviewError.id === session.id && reviewError.revision === session.revision
    && (!reviewError.saveFailed || saveError)
    ? reviewError.text : null

  function chooseSource(next) {
    setSource(next)
    setSelectedId(null)
    setReviewError(null)
  }

  function changeTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'recorded' : event.key === 'End' ? 'fictional'
      : activeSource === 'recorded' ? 'fictional' : 'recorded'
    chooseSource(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }

  function review() {
    if (!session || typeof onReview !== 'function') return
    setReviewError(null)
    try {
      if (onReview(session.id, session.revision) === false) {
        setReviewError({ id: session.id, revision: session.revision, saveFailed: true, text: 'The review could not be saved to this device. Keep this page open and retry saving your changes.' })
      } else reviewStatus.current?.focus()
    } catch {
      setReviewError({ id: session.id, revision: session.revision, text: 'The review could not be recorded. Please try again.' })
    }
  }

  return (
    <section className={`session-handoff${example ? ' session-handoff-example' : ''}`} aria-labelledby={`${id}-heading`}>
      <header className="session-handoff-heading">
        <div><h2 id={`${id}-heading`}>Session handoff</h2></div>
        <span className="session-handoff-mark" aria-hidden="true">☾</span>
      </header>

      {recorded.length > 0 && fictional.length > 0 && <div className="session-handoff-tabs no-print" role="tablist" aria-label="Session handoff source" onKeyDown={changeTab}>
        {['recorded', 'fictional'].map(value => <button key={value} type="button" role="tab" id={`${id}-${value}`}
          aria-selected={activeSource === value} aria-controls={`${id}-content`} tabIndex={activeSource === value ? 0 : -1}
          onClick={() => chooseSource(value)}>{value === 'recorded' ? 'Recorded sessions' : 'Fictional examples'}</button>)}
      </div>}

      {!session ? <div className="session-handoff-empty">
        <p>No session handoff is available yet.</p>
        <p>Recorded session actions will appear here. A missing record does not mean that nothing happened.</p>
      </div> : <div id={`${id}-content`} role={recorded.length && fictional.length ? 'tabpanel' : undefined}
        aria-labelledby={recorded.length && fictional.length ? `${id}-${activeSource}` : undefined}>
        <div className="session-handoff-provenance">
          <strong>{example ? 'FICTIONAL EXAMPLE · Not a care record' : 'Prepared from recorded actions'}</strong>
          <p>{example ? 'Every action in this view is fictional. Recorded sessions are kept separate.' : 'This summary follows this session’s recorded actions. It does not infer how the person felt or whether an activity helped.'}</p>
        </div>

        {available.length > 1 && <label className="session-handoff-select no-print">
          <span>Choose an evening session</span>
          <select value={session.id} onChange={event => { setSelectedId(event.target.value); setReviewError(null) }}>
            {available.map(entry => <option key={entry.id} value={entry.id}>{formatDate(entry.date)} · {formatTime(entry.startedAt)}{string(entry.displayName).trim() ? ` · ${entry.displayName}` : ''}</option>)}
          </select>
        </label>}

        <div className="session-handoff-meta">
          <div><span>Evening</span><strong>{formatDate(session.date)}</strong></div>
          <div><span>Session started</span><strong>{formatTime(session.startedAt)} · local time</strong></div>
          {string(session.displayName).trim() && <div><span>{example ? 'Example profile' : 'Profile at session start'}</span><strong>{session.displayName}</strong></div>}
        </div>

        <section className="session-handoff-preferences" aria-label="Caregiver preferences at session start">
          <h3>For the next caregiver</h3>
          <p>Caregiver-provided details saved at session start. These are preferences, not recorded actions.</p>
          <dl>
            <div><dt>Helpful approach</dt><dd>{string(session.plan?.caregiverCue) || 'Not recorded'}</dd></div>
            <div><dt>Please avoid</dt><dd>{string(session.plan?.avoid) || 'Not recorded'}</dd></div>
          </dl>
        </section>

        <ol className="session-handoff-lines">
          {session.lines.map((line, index) => <li key={`${line.id}:${index}`} className={line.id.endsWith(':missing-observation') ? 'session-handoff-missing' : undefined}>
            <p>{displayLine(line, session)}</p>
            {[...new Set(line.eventIds.filter(eventId => typeof eventId === 'string' && eventId))].map(eventId => <SourceEvent key={eventId} eventId={eventId} events={session.events} />)}
          </li>)}
        </ol>

        <footer className="session-handoff-review">
          <div ref={reviewStatus} tabIndex={-1} role="status"><strong>{reviewed ? saveError ? 'Review not saved' : 'Reviewed by caregiver' : 'Caregiver review pending'}</strong><p>{reviewed ? saveError ? 'The review is only in this open session until saving succeeds.' : 'Review applies to the actions currently shown. New actions need a fresh review.' : 'Check the source actions before marking this handoff reviewed.'}</p></div>
          {typeof onReview === 'function' && (!reviewed || saveError) && <button type="button" className="no-print" onClick={review}>{reviewed && saveError ? 'Retry saving review' : example ? 'Review this example' : 'Mark as reviewed'}</button>}
          {currentError && <p role="alert" className="session-handoff-review-error">{currentError}</p>}
        </footer>
        <p className="session-handoff-note">Missing actions or observations remain unknown. This handoff is prepared on this device; it is not automatically sent to a care team.</p>
      </div>}
    </section>
  )
}
