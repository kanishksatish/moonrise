import { eveningDate, moonPhase, moonriseStart, skyGradient, skyState } from '../engine/index.js'
import includedCatalog from '../assets/audio/catalog.json'
import { formatDuration, formatTime } from '../components/format.js'
import { eveningKey } from '../components/eveningLog.js'
import useNow from '../components/useNow.js'
import MoonIcon from '../components/MoonIcon.jsx'
import Constellation from '../components/Constellation.jsx'
import '../styles/observatory.css'
import EveningWorkspace from '../components/EveningWorkspace.jsx'

export default function Today({ state, sky, saveError = false, onStart, onPersonalize, reminders, onSavePlan }) {
  const now = useNow()
  const { permission = 'unsupported', askPermission, alertText = null } = reminders ?? {}
  const { profile, logs } = state

  const schedule = sky ? moonriseStart(sky.effectiveDusk, logs.filter(log => !log.demo)) : null
  const tonightLog = logs.find((l) => l.date === eveningKey(now) && !l.demo)
  const moon = moonPhase(now)
  const gradient = skyGradient(skyState(now, profile.lat, profile.lon).darkness)

  const approvedCount = state.approvedPrompts?.length ?? 0

  return (
    <div className="today">
      <p className="today-date small">{eveningDate(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      <EveningWorkspace profile={profile} plan={state.eveningPlan} onSave={onSavePlan} onStart={onStart} saveError={saveError} startTime={sky ? formatTime(schedule.start) : null}/>
      {alertText && !tonightLog && <div className="alert" role="alert">{alertText}</div>}

      <div className="evening-layout evening-context">
        <div className="evening-primary">
          {sky && <details className="sky-facts">
            <summary><span>Behind tonight’s timing</span><span className="sky-summary-time">Estimated dusk {formatTime(sky.effectiveDusk)}</span></summary>
            <p>Estimated dusk <strong>{formatTime(sky.effectiveDusk)}</strong></p>
            <p className="small">{sky.cached && 'Using the last available weather. '}{sky.source === 'offline'
              ? `Sunset ${formatTime(sky.sunset)}. No weather data right now, so no cloud adjustment.`
              : !Number.isFinite(sky.cloudCover) ? `Sunset ${formatTime(sky.sunset)}. Cloud data is unavailable, so no cloud adjustment.`
              : sky.shiftMinutes > 0 ? `Sunset ${formatTime(sky.sunset)}. With ${Math.round(sky.cloudCover)}% cloud, our estimate moves dusk ${sky.shiftMinutes} min earlier.`
              : `Sunset ${formatTime(sky.sunset)}. Clear sky, no adjustment.`}</p>
            <p className="small">{schedule.basis === 'learned'
              ? `Starting ${schedule.minutesBeforeDusk} min before dusk, based on ${schedule.episodesUsed} logged episode${schedule.episodesUsed === 1 ? '' : 's'}.`
              : `Starting ${schedule.minutesBeforeDusk} min before dusk. After 3 logged evenings and at least one episode time, this suggestion can adjust.`}</p>
          </details>}
        </div>

        <aside className="evening-journal" aria-label="Your evening journal">
          <Constellation logs={logs.filter(log => !log.demo)} now={now}/>
          {tonightLog && <p className="logged"><span className="logged-star" aria-hidden="true">✧</span><span>{saveError ? 'Changes are waiting to be saved.' : 'Tonight’s note is saved.'}<br/>{saveError ? 'Current label: ' : 'Recorded as '}<strong>{tonightLog.outcome}</strong>.</span></p>}
          <section className="personal-note">
            <div className="record-art" aria-hidden="true"><span/></div>
            <p className="eyebrow">The listening library</p>
            <h2>Something<br/><em>familiar.</em></h2>
            <p>{includedCatalog.length} included recordings to play here, or choose a music file from your device.</p>
            <p className="muted">{approvedCount ? `${approvedCount} conversation starter${approvedCount === 1 ? '' : 's'} selected by you.` : 'Conversation starters are ready whenever you need one.'}</p>
            {onPersonalize && <button className="text-action" onClick={onPersonalize}>Make it personal <span aria-hidden="true">↗</span></button>}
          </section>
        </aside>
      </div>

      <footer className="today-footer">
        <div className="reminder-line">
          {permission === 'default' && askPermission && <button className="btn" onClick={askPermission}>Turn on reminders</button>}
          {(permission === 'default' || permission === 'granted') && <p className="small alert-hint">Keep Moonrise open for routine reminders.</p>}
          {permission === 'denied' && <p className="small alert-hint">Browser notifications are off. Routine reminders still appear here.</p>}
          {permission === 'unsupported' && <p className="small alert-hint">This browser does not support notifications. Routine reminders still appear here.</p>}
        </div>
        <p className="small care-note">A suggested routine based on the sky and your logs.<br/>Caregiver support, not a medical treatment.</p>
      </footer>
    </div>
  )
}
