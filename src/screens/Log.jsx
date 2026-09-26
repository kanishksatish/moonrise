import { useState } from 'react'
import { addLog } from '../engine/index.js'
import { prettyDate } from '../components/format.js'
import { eveningKey, makeEveningLog } from '../components/eveningLog.js'
import '../styles/onboarding.css'

const OUTCOMES = [
  { id: 'calm', label: 'Calm', hint: 'A peaceful evening' },
  { id: 'restless', label: 'Restless', hint: 'Unsettled, but okay' },
  { id: 'episode', label: 'Episode', hint: 'Agitated or confused' },
]

function OutcomeMark({ outcome }) {
  return (
    <svg className="outcome-mark" aria-hidden="true" viewBox="0 0 72 72" fill="none">
      <circle className="outcome-mark-orbit" cx="36" cy="36" r="34" />
      {outcome === 'calm' && <><path d="M17 29h38M17 36h38M17 43h38"/><circle cx="36" cy="20" r="2" fill="currentColor" stroke="none"/></>}
      {outcome === 'restless' && <><path d="M16 29c7-11 13 11 20 0s13 11 20 0M16 37c7-11 13 11 20 0s13 11 20 0M16 45c7-11 13 11 20 0s13 11 20 0"/></>}
      {outcome === 'episode' && <><path d="m16 37 9-9 11 17 11-17 9 9M21 48h30M21 21h30"/></>}
    </svg>
  )
}

function timeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function Log({ state, sky, update, onDone }) {
  const today = eveningKey()
  const existing = state.logs.find((l) => l.date === today)
  const [askTime, setAskTime] = useState(false)
  const [error, setError] = useState('')
  const [time, setTime] = useState(() =>
    existing?.episodeStart ? timeValue(new Date(existing.episodeStart)) : timeValue(new Date())
  )

  function save(outcome, episodeTime) {
    try {
      const log = makeEveningLog(state, sky, outcome, episodeTime, new Date())
      update(addLog(state, log))
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  function choose(outcome) {
    if (!save(outcome)) return
    if (outcome === 'episode') setAskTime(true)
    else onDone()
  }

  function saveTime() {
    if (save('episode', time)) onDone()
  }

  if (!sky) return <p className="big-number">Checking tonight’s sky…</p>

  if (askTime) {
    return (
      <div className="log evening-journal log-time">
        <header className="journal-heading">
          <p className="eyebrow">One last detail</p>
          <h1>When did it start?</h1>
          <p className="lead">Evening of {prettyDate(today)}. After-midnight times count toward this evening.</p>
        </header>
        <div className="journal-time-entry">
          <svg className="journal-clock" aria-hidden="true" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27"/><path d="M32 14v18l11 7M32 5v4M32 55v4M5 32h4M55 32h4"/></svg>
          <p>Optional. This helps adjust the suggested routine time.</p>
          {error && <p className="status" role="alert">{error}</p>}
          <input
            className="time-input"
            type="time"
            value={time}
            onChange={(e) => { setTime(e.target.value); setError('') }}
            aria-label="Episode started at"
          />
          <div className="journal-time-actions">
            <button className="btn primary huge" onClick={saveTime}>Save time</button>
            <button className="btn" onClick={onDone}>Skip</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="log evening-journal">
      <header className="journal-heading">
        <p className="eyebrow">The evening journal</p>
        <h1>How was tonight?</h1>
        <p className="lead">Every evening is worth remembering.</p>
        <p className="journal-date"><span aria-hidden="true"/>Evening of {prettyDate(today)}</p>
      </header>
      {error && <p className="status" role="alert">{error}</p>}
      {existing && <p className="journal-recorded">Logged as <strong>{existing.outcome}</strong>. Tap to change.</p>}
      <div className="journal-outcomes">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            aria-label={o.label}
            aria-describedby={`outcome-${o.id}-hint`}
            className={`btn outcome ${o.id}${existing?.outcome === o.id ? ' chosen' : ''}`}
            onClick={() => choose(o.id)}
          >
            <OutcomeMark outcome={o.id} />
            <span className="outcome-copy">
              <span className="outcome-label">{o.label}</span>
              <span className="outcome-hint" id={`outcome-${o.id}-hint`}>{o.hint}</span>
            </span>
            <span className="outcome-action" aria-hidden="true">{existing?.outcome === o.id ? '✓' : '↗'}</span>
          </button>
        ))}
      </div>
      <p className="journal-footnote">A small note now. A clearer picture over time.</p>
    </div>
  )
}
