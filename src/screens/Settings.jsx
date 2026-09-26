import { useState } from 'react'
import { addDemoLogs, clearDemoLogs, emptyState, eveningDate, generateDemoWeek } from '../engine/index.js'
import { prettyDate } from '../components/format.js'

export default function Settings({ state, update, onEditProfile }) {
  const { profile, logs } = state
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const demoCount = logs.filter((l) => l.demo).length
  const realCount = logs.length - demoCount

  function loadDemo() {
    // The week ends yesterday, so tonight stays free for a real log.
    const yesterday = eveningDate(new Date())
    yesterday.setDate(yesterday.getDate() - 1)
    const week = generateDemoWeek({ birthYear: profile.birthYear, lat: profile.lat, lon: profile.lon, endDate: yesterday })
    const realDates = new Set(logs.filter((l) => !l.demo).map((l) => l.date))
    // Never overwrite a real evening with demo data.
    update(addDemoLogs(clearDemoLogs(state), week.filter((l) => !realDates.has(l.date))))
    setMessage(`Loaded demo week: ${prettyDate(week[0].date)} to ${prettyDate(week.at(-1).date)}.`)
  }

  function clearDemo() {
    update(clearDemoLogs(state))
    setMessage('Demo data removed.')
  }

  function resetAll() {
    update(emptyState())
  }

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="card">
        <h2>{profile.name}</h2>
        <p className="muted">
          Born {profile.birthYear} · {profile.city}
        </p>
        <button className="btn" onClick={onEditProfile}>
          Edit details
        </button>
      </section>

      <section className="card demo-card">
        <h2>Demo data</h2>
        <p>
          Fills the last 7 evenings with made-up logs so you can see how Moonrise learns. Clearly marked as demo data.
          Real evenings are never replaced.
        </p>
        <button className="btn primary" onClick={loadDemo}>
          Load demo week
        </button>
        {demoCount > 0 && (
          <button className="btn" onClick={clearDemo}>
            Remove demo data ({demoCount} evenings)
          </button>
        )}
        {message && (
          <p className="status" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Start over</h2>
        <p className="muted">
          {realCount} real evening{realCount === 1 ? '' : 's'} logged.
        </p>
        {confirmReset ? (
          <>
            <p>This deletes everything on this device. Are you sure?</p>
            <button className="btn danger" onClick={resetAll}>
              Yes, delete everything
            </button>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Keep my data
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>
            Delete all data
          </button>
        )}
      </section>

      <p className="muted small">Moonrise supports caregivers. It is not a medical treatment.</p>
    </div>
  )
}
