import { useEffect, useRef, useState } from 'react'
import { moonPhase, moonriseStart, skyGradient, skyState } from '../engine/index.js'
import { formatDuration, formatTime, todayString } from '../components/format.js'
import useNow from '../components/useNow.js'
import MoonIcon from '../components/MoonIcon.jsx'

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

export default function Today({ state, sky, onStart }) {
  const now = useNow()
  const firedRef = useRef(new Set())
  const [permission, setPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const { profile, logs } = state

  const schedule = sky ? moonriseStart(sky.effectiveDusk, logs) : null
  const stage = schedule ? alertStage(now, schedule.start) : null
  const duskPassed = sky && now > sky.effectiveDusk
  const tonightLog = logs.find((l) => l.date === todayString(now))
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
    const key = `${todayString(now)}:${stage}`
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

  return (
    <div className="today">
      <header className="today-head">
        <h1>Tonight for {profile.name}</h1>
        {profile.city && <p className="muted">{profile.city}</p>}
      </header>

      {alertText && !tonightLog && (
        <div className="alert" role="alert">
          {alertText}
        </div>
      )}

      <section
        className="sky-card"
        style={{ background: `linear-gradient(to bottom, ${gradient.top}, ${gradient.bottom})` }}
      >
        {!sky ? (
          <p className="big-number">Checking the sky…</p>
        ) : (
          <>
            <div className="sky-row">
              <div>
                <p className="label">Start Moonrise at</p>
                <p className="big-number">{formatTime(schedule.start)}</p>
                <p className="countdown">
                  {now < schedule.start ? `in ${formatDuration(schedule.start - now)}` : duskPassed ? 'Dusk has passed' : 'Now'}
                </p>
              </div>
              <div className="moon-box">
                <MoonIcon name={moon.name} />
                <p className="small">{moon.name}</p>
              </div>
            </div>

            <div className="sky-facts">
              <p>
                Dusk tonight <strong>{formatTime(sky.effectiveDusk)}</strong>
              </p>
              <p className="small">
                {sky.source === 'offline'
                  ? `Sunset ${formatTime(sky.sunset)}. No weather data right now, so no cloud adjustment.`
                  : sky.shiftMinutes > 0
                    ? `Sunset ${formatTime(sky.sunset)}, but ${Math.round(sky.cloudCover)}% cloud brings dusk ${sky.shiftMinutes} min earlier.`
                    : `Sunset ${formatTime(sky.sunset)}. Clear sky, no adjustment.`}
              </p>
              <p className="small">
                {schedule.basis === 'learned'
                  ? `Starting ${schedule.minutesBeforeDusk} min before dusk, learned from ${schedule.episodesUsed} logged episode${schedule.episodesUsed === 1 ? '' : 's'}.`
                  : `Starting ${schedule.minutesBeforeDusk} min before dusk. After 3 logged evenings, Moonrise learns the best time.`}
              </p>
            </div>
          </>
        )}
      </section>

      <button className="btn primary huge" onClick={onStart}>
        Start Moonrise now
      </button>

      {tonightLog && (
        <p className="logged">
          Tonight is logged: <strong>{tonightLog.outcome}</strong>
        </p>
      )}

      {permission === 'default' && (
        <button className="btn" onClick={askPermission}>
          Turn on alerts
        </button>
      )}
    </div>
  )
}
