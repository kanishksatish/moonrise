import { useState } from 'react'
import { addDemoLogs, clearAiKey, clearDemoLogs, emptyState, eveningDate, generateDemoWeek } from '../engine/index.js'
import { prettyDate } from '../components/format.js'
import AiPrompts from '../components/AiPrompts.jsx'
import DeviceReadiness from '../components/DeviceReadiness.jsx'
import '../styles/settings-experience.css'
import { clearComfortPhotos } from '../engine/comfortPhoto.js'

export default function Settings({ state, update, saveError = false, onEditProfile }) {
  const { profile, logs } = state
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetError, setResetError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const demoCount = logs.filter((l) => l.demo).length
  const demoSessionCount = (state.sessions || []).filter(session => session.isDemo).length
  const realCount = logs.length - demoCount

  function loadDemo() {
    // The week ends yesterday, so tonight stays free for a real log.
    const yesterday = eveningDate(new Date())
    yesterday.setDate(yesterday.getDate() - 1)
    const week = generateDemoWeek({ birthYear: profile.birthYear, lat: profile.lat, lon: profile.lon, endDate: yesterday })
    const realDates = new Set(logs.filter((l) => !l.demo).map((l) => l.date))
    // Never overwrite a real evening with demo data.
    const withoutExampleLogs = { ...clearDemoLogs(state), ...(Array.isArray(state.sessions) ? { sessions: state.sessions } : {}) }
    update(addDemoLogs(withoutExampleLogs, week.filter((l) => !realDates.has(l.date))))
    setMessage(`Loaded demo week: ${prettyDate(week[0].date)} to ${prettyDate(week.at(-1).date)}.`)
  }

  function clearDemo() {
    update(clearDemoLogs(state))
    setMessage('Demo data removed.')
  }

  async function resetAll() {
    if (deleting) return
    setDeleting(true)
    try {
      if (typeof indexedDB !== 'undefined') await clearComfortPhotos()
    } catch {
      setResetError('Saved photos could not be removed. Your profile and records remain here. Retry, or clear Moonrise site data in your browser settings.')
      setDeleting(false)
      return
    }
    if (!clearAiKey()) {
      setResetError('Could not remove the browser-saved API key. Clear Moonrise site data in your browser settings. A local server key must be disconnected separately.')
      setDeleting(false); return
    }
    if (update(emptyState()) === false) {
      setResetError('Your profile and logs could not be deleted from this browser. They remain available here. Retry, or clear Moonrise site data in your browser settings. Disconnect any local server key separately.')
    }
    setDeleting(false)
  }

  return (
    <div className="settings settings-experience">
      <header className="settings-heading">
        <p className="eyebrow">Caregiver settings</p>
        <h1>Make it <em>personal.</em></h1>
        <p>Familiar music. Meaningful words. A little preparation for your time together.</p>
      </header>

      <section className="settings-profile" aria-label="Current profile">
        <span className="settings-initial" aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase()}</span>
        <div><h2>{profile.name}</h2><p>Born {profile.birthYear} · {profile.city}</p></div>
        <button className="btn" onClick={onEditProfile}>
          Edit details
        </button>
      </section>

      <div className="settings-columns">
        <div className="settings-main"><AiPrompts state={state} update={update} saveError={saveError} /></div>
        <aside className="settings-side" aria-label="Device and caregiver guidance">
          <DeviceReadiness />
          <section className="settings-care-note">
            <p className="eyebrow">Let them lead</p>
            <h2>Company is enough.</h2>
            <p>Offer music or a conversation. There is no need to remember an answer or finish a routine. Quiet company counts, too.</p>
            <p className="muted">Stop if the person seems uncomfortable. For new or concerning changes, follow their care plan and contact the care team. Moonrise is not monitored by a clinician.</p>
          </section>
        </aside>
      </div>

      <section className="settings-data-section" aria-labelledby="device-data-heading">
        <div><p className="eyebrow">Your information</p><h2 id="device-data-heading">{saveError ? 'Changes need saving.' : 'Saved in this browser.'}</h2></div>
        <div><p>Your profile, photos, session records, evening logs and selected starters stay in this browser. Anyone with access to this browser profile can view them. Moonrise has no account lock or automatic care-team sharing.</p>
          <p className="muted">Optional generated suggestions send the details listed above to the connected provider. A hospice pilot needs the organization’s approval of its devices, data handling and clinical workflow.</p>
        </div>
      </section>

      <div className="settings-utilities">
      <section className="card demo-card">
        <h2>Try an example week</h2>
        <p>
          Explore the journal with seven fictional evenings, clearly marked as demo data. Recorded evenings are never replaced; reports keep the two sources separate.
        </p>
        <button className="btn primary" onClick={loadDemo}>
          Load demo week
        </button>
        {(demoCount > 0 || demoSessionCount > 0) && (
          <button className="btn" onClick={clearDemo}>
            Remove demo data ({demoCount} evenings{demoSessionCount ? `, ${demoSessionCount} sessions` : ''})
          </button>
        )}
        {message && (
          <p className="status" role="status">
            {message}{saveError && ' This change is only in this open session until saving succeeds.'}
          </p>
        )}
      </section>

      <section className="card settings-reset">
        <h2>Start over</h2>
        <p className="muted">
          {realCount} real evening{realCount === 1 ? '' : 's'} logged.
        </p>
        {confirmReset ? (
          <>
            <p>This deletes your profile, photos, sessions, logs, approved prompts and browser-saved API key. A key connected through the local server must be disconnected on its connection page separately. Are you sure?</p>
            <button className="btn danger" disabled={deleting} onClick={resetAll}>
              {deleting ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button className="btn" disabled={deleting} onClick={() => setConfirmReset(false)}>
              Keep my data
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>
            Delete all data
          </button>
        )}
        {resetError && <p className="status" role="alert">{resetError}</p>}
      </section>
      </div>

      <p className="muted small">Moonrise supports caregivers. It is not a medical treatment.</p>
    </div>
  )
}
