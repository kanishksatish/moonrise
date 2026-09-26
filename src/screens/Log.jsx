import { useState } from 'react'
import { addLog } from '../engine/index.js'
import { todayString } from '../components/format.js'

const OUTCOMES = [
  { id: 'calm', label: 'Calm', hint: 'A peaceful evening' },
  { id: 'restless', label: 'Restless', hint: 'Unsettled, but okay' },
  { id: 'episode', label: 'Episode', hint: 'Agitated or confused' },
]

function timeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function Log({ state, sky, update, onDone }) {
  const today = todayString()
  const existing = state.logs.find((l) => l.date === today)
  const [askTime, setAskTime] = useState(false)
  const [time, setTime] = useState(() =>
    existing?.episodeStart ? timeValue(new Date(existing.episodeStart)) : timeValue(new Date())
  )

  function save(outcome, episodeStart = null) {
    const songIds = state.tonight?.date === today ? state.tonight.songIds : existing?.songIds ?? []
    update(
      addLog(state, {
        date: today,
        outcome,
        episodeStart,
        effectiveDusk: sky.effectiveDusk.toISOString(),
        cloudCover: sky.cloudCover,
        songIds,
      })
    )
  }

  function choose(outcome) {
    save(outcome)
    if (outcome === 'episode') setAskTime(true)
    else onDone()
  }

  function saveTime() {
    const [h, m] = time.split(':').map(Number)
    const start = new Date()
    start.setHours(h, m, 0, 0)
    save('episode', start.toISOString())
    onDone()
  }

  if (!sky) return <p className="big-number">Checking tonight’s sky…</p>

  if (askTime) {
    return (
      <div className="log">
        <h1>When did it start?</h1>
        <p className="lead">Optional. This helps Moonrise learn the best start time.</p>
        <input
          className="time-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
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
      {existing && (
        <p className="lead">
          Logged as <strong>{existing.outcome}</strong>. Tap to change.
        </p>
      )}
      {OUTCOMES.map((o) => (
        <button
          key={o.id}
          className={`btn outcome ${o.id}${existing?.outcome === o.id ? ' chosen' : ''}`}
          onClick={() => choose(o.id)}
        >
          <span className="outcome-label">{o.label}</span>
          <span className="outcome-hint">{o.hint}</span>
        </button>
      ))}
    </div>
  )
}
