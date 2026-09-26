import { useEffect, useRef, useState } from 'react'
import { eveningDate, moonPhase, moonriseStart, skyGradient, skyState } from '../engine/index.js'
import includedCatalog from '../assets/audio/catalog.json'
import { formatDuration, formatTime } from '../components/format.js'
import { eveningKey } from '../components/eveningLog.js'
import useNow from '../components/useNow.js'
import MoonIcon from '../components/MoonIcon.jsx'
import Constellation from '../components/Constellation.jsx'

const HEADS_UP_MINUTES = 10
const MINUTE = 60000

// Which alert, if any, should show right now.
function alertStage(now, start) {
  const untilStart = start - now
  if (untilStart <= 0) return 'start'
  if (untilStart <= HEADS_UP_MINUTES * MINUTE) return 'soon'
  return null
}

function notify(text) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Moonrise', { body: text })
    }
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Alerts are a bonus; the on-screen banner is always shown.
  }
}

export default function Today({ state, sky, onStart, onPersonalize }) {
  const now = useNow()
  const firedRef = useRef(new Set())
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const { profile, logs } = state

  const schedule = sky ? moonriseStart(sky.effectiveDusk, logs) : null
  const stage = schedule ? alertStage(now, schedule.start) : null
  const duskPassed = sky && now > sky.effectiveDusk
  const tonightLog = logs.find((l) => l.date === eveningKey(now))
  const moon = moonPhase(now)
  const gradient = skyGradient(skyState(now, profile.lat, profile.lon).darkness)

  const alertText =
    stage === 'soon'
      ? `Moonrise starts in ${formatDuration(schedule.start - now)}. Time to settle in.`
      : stage === 'start' && !duskPassed
        ? 'It’s time. Start Moonrise now.'
        : null

  // Fire each alert once per evening.
  useEffect(() => {
    if (!alertText || tonightLog) return
    const key = `${eveningKey(now)}:${stage}`
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)
    notify(alertText)
  }, [alertText, stage, now, tonightLog])

  async function askPermission() {
    try {
      setPermission(await Notification.requestPermission())
    } catch {
      setPermission('denied')
    }
  }

  const approvedCount = state.approvedPrompts?.length ?? 0

  return (
    <div className="today">
      <header className="today-head page-heading">
        <div><p className="eyebrow">An evening, together</p><h1>A softer landing. <br/><em>For both of you.</em></h1></div>
        <p className="today-date">{eveningDate(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </header>
      {logs.some(log => log.demo) && <p className="demo-flag"><span aria-hidden="true">◌ </span>Demo data is included in the routine suggestions.</p>}
      {alertText && !tonightLog && <div className="alert" role="alert">{alertText}</div>}

      <div className="evening-layout">
        <div className="evening-primary">
          <section className="evening-scene" aria-label={`Tonight for ${profile.name}`}
            style={{ '--sky-top': gradient.top, '--sky-bottom': gradient.bottom }}>
            <div className="scene-landscape" aria-hidden="true"/>
            <div className="scene-topline"><span>Tonight for {profile.name}</span><span className="scene-mark" aria-hidden="true">✦</span></div>
            <div className="scene-moon" aria-hidden="true">
              <svg className="lunar-orbits" viewBox="0 0 400 400"><circle cx="200" cy="200" r="188"/><circle cx="200" cy="200" r="155"/><path d="M12 200H40M360 200H388M200 12V40M200 360V388"/><circle className="orbit-point" cx="333" cy="67" r="4"/></svg>
              <MoonIcon phase={moon.phase} decorative/>
            </div>
            <div className="scene-content">
              <p className="label">Your suggested start</p>
              <p className={sky ? 'scene-time' : 'scene-loading'}>{sky ? formatTime(schedule.start) : 'Checking the sky…'}</p>
              <p className="scene-countdown">{!sky ? 'You can begin while we check.' : now < schedule.start ? `In ${formatDuration(schedule.start - now)}` : 'Ready whenever you are.'}</p>
              <button className="btn primary start-routine" onClick={onStart}><span>Start Moonrise now</span><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>
            </div>
            <div className="scene-footer"><span>{profile.city || 'Your evening sky'}</span><span className="phase-label"><i aria-hidden="true"/>{moon.name}</span></div>
          </section>

          <div className="routine-path" aria-label="Your evening routine">
            <div><span className="step-number">01</span><p>Settle in<span>A little space to slow down.</span></p></div>
            <div><span className="step-number">02</span><p>Play a memory<span>Music. A story. A moment.</span></p></div>
            <div><span className="step-number">03</span><p>Keep a little note<span>Every kind of evening counts.</span></p></div>
          </div>

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
          {tonightLog && <p className="logged"><span className="logged-star" aria-hidden="true">✦</span><span>Tonight is logged: <strong>{tonightLog.outcome}</strong>.<br/>A star for showing up.</span></p>}
          <section className="personal-note">
            <div className="record-art" aria-hidden="true"><span/></div>
            <p className="eyebrow">The listening library</p>
            <h2>A little music.<br/><em>A moment together.</em></h2>
            <p>{includedCatalog.length} included recordings to play here, or choose a music file from your device.</p>
            <p className="muted">{approvedCount ? `${approvedCount} AI-written prompt${approvedCount === 1 ? '' : 's'}, selected by you.` : 'Built-in conversation starters, ready to go.'}</p>
            {onPersonalize && <button className="text-action" onClick={onPersonalize}>Make it personal <span aria-hidden="true">↗</span></button>}
          </section>
        </aside>
      </div>

      <footer className="today-footer">
        <div className="reminder-line">
          {permission === 'default' && <button className="btn" onClick={askPermission}>Turn on reminders</button>}
          {(permission === 'default' || permission === 'granted') && <p className="small alert-hint">Keep Moonrise open for routine reminders.</p>}
        </div>
        <p className="small care-note">A suggested routine based on the sky and your logs.<br/>Caregiver support, not a medical treatment.</p>
      </footer>
    </div>
  )
}
