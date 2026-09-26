import { useState } from 'react'
import { addLog } from '../engine/index.js'
import { prettyDate } from '../components/format.js'
import { eveningKey, makeEveningLog } from '../components/eveningLog.js'

const OUTCOMES = [
  { id: 'calm', label: 'Calm', hint: 'A peaceful evening' },
  { id: 'restless', label: 'Restless', hint: 'Unsettled, but okay' },
  { id: 'episode', label: 'Episode', hint: 'Agitated or confused' },
]

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
      <div className="log">
        <h1>When did it start?</h1>
        <p className="lead">Evening of {prettyDate(today)}. After-midnight times count toward this evening.</p>
        <p>Optional. This helps adjust the suggested routine time.</p>
        {error && <p className="status" role="alert">{error}</p>}
        <input
          className="time-input"
          type="time"
          value={time}
          onChange={(e) => { setTime(e.target.value); setError('') }}
          aria-label="Episode started at"
        />
        <button className="btn primary huge" onClick={saveTime}>
          Save time
        </button>
        <button className="btn" onClick={onDone}>
          Skip
        </button>
      </div>
    )
  }

  return (
    <div className="log">
      <h1>How was tonight?</h1>
      <p className="muted">Evening of {prettyDate(today)}</p>
      {error && <p className="status" role="alert">{error}</p>}
      {existing && (
        <p className="lead">
          Logged as <strong>{existing.outcome}</strong>. Tap to change.
        </p>
      )}
      {OUTCOMES.map((o) => (
        <button
          key={o.id}
          aria-label={o.label}
          aria-describedby={`outcome-${o.id}-hint`}
          className={`btn outcome ${o.id}${existing?.outcome === o.id ? ' chosen' : ''}`}
          onClick={() => choose(o.id)}
        >
          <span className="outcome-label">{o.label}</span>
          <span className="outcome-hint" id={`outcome-${o.id}-hint`}>{o.hint}</span>
        </button>
      ))}
    </div>
  )
}
