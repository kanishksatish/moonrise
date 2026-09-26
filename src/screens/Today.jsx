import { eveningDate, moonPhase, moonriseStart, skyGradient, skyState } from '../engine/index.js'
import includedCatalog from '../assets/audio/catalog.json'
import { formatDuration, formatTime } from '../components/format.js'
import { eveningKey } from '../components/eveningLog.js'
import useNow from '../components/useNow.js'
import MoonIcon from '../components/MoonIcon.jsx'
import Constellation from '../components/Constellation.jsx'
import '../styles/observatory.css'

export default function Today({ state, sky, saveError = false, onStart, onPersonalize, reminders }) {
  const now = useNow()
  const { permission = 'unsupported', askPermission, alertText = null } = reminders ?? {}
  const { profile, logs } = state

  const schedule = sky ? moonriseStart(sky.effectiveDusk, logs) : null
  const tonightLog = logs.find((l) => l.date === eveningKey(now) && !l.demo)
  const moon = moonPhase(now)
  const gradient = skyGradient(skyState(now, profile.lat, profile.lon).darkness)

  const approvedCount = state.approvedPrompts?.length ?? 0

  return (
    <div className="today">
      <header className="today-head page-heading">
        <div><p className="eyebrow"><span aria-hidden="true"/>An evening, together</p><h1>Your evening,<br/><em>at your own pace.</em></h1></div>
        <p className="today-date"><span>{eveningDate(now).toLocaleDateString(undefined, { weekday: 'long' })}</span>{eveningDate(now).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
      </header>
      {logs.some(log => log.demo) && <p className="demo-flag"><span aria-hidden="true">◌ </span>Demo data is included in the routine suggestions.</p>}
      {alertText && !tonightLog && <div className="alert" role="alert">{alertText}</div>}

      <div className="evening-layout">
        <div className="evening-primary">
          <section className="evening-scene" aria-label={`Tonight for ${profile.name}`}
            style={{ '--sky-top': gradient.top, '--sky-bottom': gradient.bottom }}>
            <div className="scene-landscape" aria-hidden="true"/>
            <div className="scene-topline"><span>Tonight for {profile.name}</span><span className="scene-mark" aria-hidden="true"><span/>Your evening sky</span></div>
            <div className="scene-moon" aria-hidden="true">
              <svg className="lunar-orbits" viewBox="0 0 400 400"><circle cx="200" cy="200" r="188"/><circle cx="200" cy="200" r="155"/><path d="M12 200H40M360 200H388M200 12V40M200 360V388"/><circle className="orbit-point" cx="333" cy="67" r="4"/></svg>
              <MoonIcon phase={moon.phase} decorative/>
            </div>
            <div className="scene-content">
              <p className="label">Your suggested start</p>
              <p className={sky ? 'scene-time' : 'scene-loading'}>{sky ? formatTime(schedule.start) : 'Checking the sky…'}</p>
              <p className="scene-countdown">{!sky ? 'You can begin while we check.' : now < schedule.start ? `In ${formatDuration(schedule.start - now)}` : 'Ready whenever you are.'}</p>
              <button className="btn primary start-routine" onClick={onStart}><span>Start Moonrise now</span><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
              <p className="scene-reassurance">A familiar song. A little time together.</p>
            </div>
            <div className="scene-footer"><span className="scene-location"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M18 10c0 4.5-6 10-6 10S6 14.5 6 10a6 6 0 1 1 12 0Z"/><circle cx="12" cy="10" r="2"/></svg>{profile.city || 'Your evening sky'}</span><span className="phase-label"><i aria-hidden="true"/>{moon.name}</span></div>
          </section>

          <section className="routine-path" aria-labelledby="routine-path-title">
            <h2 id="routine-path-title">Keep it simple tonight.</h2>
            <ol>
              <li><span className="step-number" aria-hidden="true">01</span><p>Make a little space<span>Sit somewhere familiar and comfortable.</span></p></li>
              <li><span className="step-number" aria-hidden="true">02</span><p>Follow their lead<span>Choose music, a conversation, or just quiet.</span></p></li>
              <li><span className="step-number" aria-hidden="true">03</span><p>Leave a short note<span>Record what you noticed, when you’re ready.</span></p></li>
            </ol>
          </section>

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
          <Constellation logs={logs} now={now}/>
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
