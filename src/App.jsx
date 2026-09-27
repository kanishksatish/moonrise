import { useEffect, useRef, useState } from 'react'
import { effectiveDusk, eveningDate, loadState, moonPhase, saveState } from './engine/index.js'
import { currentSky, eveningKey } from './components/eveningLog.js'
import useNow from './components/useNow.js'
import { formatTime } from './components/format.js'
import useRoutineReminders from './components/useRoutineReminders.js'
import NavBar from './components/NavBar.jsx'
import Brand from './components/Brand.jsx'
import LaunchSequence from './components/LaunchSequence.jsx'
import Setup from './screens/Setup.jsx'
import Today from './screens/Today.jsx'
import Moonrise from './screens/Moonrise.jsx'
import Log from './screens/Log.jsx'
import Report from './screens/Report.jsx'
import Settings from './screens/Settings.jsx'
import { createSession, appendSessionEvent, normalizeEveningPlan } from './engine/eveningSession.js'
import { EXAMPLE_PLAN } from './components/EveningWorkspace.jsx'

const SKY_REFRESH_MS = 30 * 60 * 1000
const SCREEN_NAMES = { today: 'Today', log: 'Evening log', report: 'Evening report', settings: 'Caregiver settings' }

function App() {
  const [state, setState] = useState(loadState)
  const stateRef = useRef(state)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [sessionToLog, setSessionToLog] = useState(null)
  const [screen, setScreen] = useState('today')
  const [sky, setSky] = useState(null)
  const [storageError, setStorageError] = useState(false)
  const [storageRetryAvailable, setStorageRetryAvailable] = useState(false)
  const [startedEvening, setStartedEvening] = useState(null)
  const profile = state.profile
  const now = useNow()
  const evening = eveningKey(now)
  const visibleSky = profile ? currentSky(sky, profile, now) : null
  const screenContent = useRef(null)
  const visibleScreen = !profile || screen === 'setup' ? 'setup' : screen
  const reminders = useRoutineReminders({
    now, sky: visibleSky, logs: state.logs.filter(log => !log.demo),
    suppressed: visibleScreen === 'setup' || visibleScreen === 'launch' || visibleScreen === 'moonrise' || startedEvening === evening,
  })

  useEffect(() => {
    // Move keyboard/screen-reader entry ahead of the new controls. Background
    // clock, sky and record updates must not move the caregiver's focus.
    ;(document.scrollingElement || document.documentElement).scrollTop = 0
    screenContent.current?.focus({ preventScroll: true })
  }, [visibleScreen])

  // Every change to state is saved right away.
  function update(value) {
    const next = typeof value === 'function' ? value(stateRef.current) : value
    const saved = saveState(next)
    setStorageError(!saved)
    setStorageRetryAvailable(!saved && Boolean(next.profile))
    // Keep usable edits in memory if storage fails, but never show a completed
    // reset while the prior browser record is still present on disk.
    if (saved || next.profile) { stateRef.current = next; setState(next) }
    return saved
  }

  function recordEvent(event) {
    if (!activeSessionId) return
    return update(current => ({ ...current, sessions: (current.sessions || []).map(session => session.id === activeSessionId
      ? appendSessionEvent(session, { id: crypto.randomUUID(), at: new Date().toISOString(), ...event }) : session) }))
  }

  function beginSession(activity = 'quiet', isDemo = false) {
    const plan = isDemo ? normalizeEveningPlan(EXAMPLE_PLAN) : normalizeEveningPlan(stateRef.current.eveningPlan)
    let session = createSession(isDemo ? { name: 'Avery (fictional)' } : profile, plan, {
      id: crypto.randomUUID(), now: new Date(), date: eveningKey(), isDemo,
    })
    session = appendSessionEvent(session, { id: crypto.randomUUID(), type: 'offered', activity, at: new Date().toISOString() })
    update(current => ({ ...current, sessions: [...(current.sessions || []), session] }))
    setActiveSessionId(session.id)
    setSessionToLog(null)
    if (!isDemo) setStartedEvening(eveningKey())
    setScreen('launch')
  }

  // Tonight's effective dusk, refreshed every 30 minutes (weather changes, and the day rolls over).
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    let request = 0
    async function refresh() {
      const captured = new Date()
      const date = eveningKey(captured)
      const id = ++request
      const result = await effectiveDusk(eveningDate(captured), profile.lat, profile.lon)
      if (!cancelled && id === request && date === eveningKey()) {
        setSky({ ...result, date, lat: profile.lat, lon: profile.lon })
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const id = setInterval(refresh, SKY_REFRESH_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [profile, evening])

  if (!profile || screen === 'setup') {
    return (
      <Setup
        profile={profile}
        saveError={storageError}
        focusRef={screenContent}
        onDone={(p) => {
          const saved = update({ ...state, profile: p })
          // A first profile is retained in memory even if the write fails.
          // Explicitly keep Setup mounted until it has actually been saved.
          setScreen(saved ? 'today' : 'setup')
          return saved
        }}
        onCancel={profile ? () => setScreen('settings') : null}
      />
    )
  }

  if (screen === 'launch') {
    return <LaunchSequence phase={moonPhase(now).phase} onComplete={() => setScreen('moonrise')} />
  }

  if (screen === 'moonrise') {
    return (
      <Moonrise
        state={state}
        session={(state.sessions || []).find(session => session.id === activeSessionId)}
        onSessionEvent={recordEvent}
        saveError={storageError}
        onPlayed={(songId) => {
          const session = (stateRef.current.sessions || []).find(item => item.id === activeSessionId)
          if (session?.isDemo) return
          const today = eveningKey()
          const current = stateRef.current
          const tonight = current.tonight?.date === today ? current.tonight : { date: today, songIds: [] }
          if (tonight.songIds.includes(songId)) return
          update({ ...current, tonight: { ...tonight, songIds: [...tonight.songIds, songId] } })
        }}
        onExit={() => { recordEvent({ type: 'finished' }); setSessionToLog(activeSessionId); setScreen('log') }}
      />
    )
  }

  return (
    <div className="app">
      <div className={`screen screen-${screen}`}>
        <header className="app-header no-print">
          <Brand />
          <div className="header-note"><span className="status-dot" aria-hidden="true"/>Evening care</div>
          <button className="profile-chip" onClick={() => setScreen('settings')} aria-label={`Settings for ${profile.name}`}><span aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase()}</span><span className="profile-name">{profile.name}</span></button>
        </header>
        {screen !== 'today' && reminders.alertText && <div className="alert" role="status">
          <p>{reminders.alertText}</p>
          <button className="btn" onClick={() => setScreen('today')}>View routine</button>
        </div>}
        {storageError && <div className="status" role="alert"><p>This device could not save your changes. Keep this page open; changes may be lost when you close it.</p>{storageRetryAvailable && screen !== 'log' && <button className="btn" onClick={() => update(state)}>Retry saving changes</button>}</div>}
        <main ref={screenContent} tabIndex={-1} aria-label={SCREEN_NAMES[screen]}>
        {screen === 'today' && <Today state={state} sky={visibleSky} saveError={storageError} reminders={reminders} onStart={beginSession}
          onSavePlan={plan => update(current => ({ ...current, eveningPlan: plan }))} onPersonalize={() => setScreen('settings')} />}
        {screen === 'log' && <Log key={`${evening}:${sessionToLog || 'journal'}`} state={state} sky={visibleSky} update={update}
          demoSession={Boolean(sessionToLog && state.sessions?.find(item => item.id === sessionToLog)?.isDemo)}
          onDemoOutcome={outcome => recordEvent({ type: 'observation', text: `Evening indicator: ${outcome}.` })}
          onSkip={sessionToLog ? () => { setSessionToLog(null); setScreen('report') } : undefined}
          onDone={savedLog => {
            if (sessionToLog) {
              const session = stateRef.current.sessions?.find(item => item.id === sessionToLog)
              const log = savedLog
              if (!session?.isDemo && log) recordEvent({ type:'observation', text: `Evening indicator: ${log.outcome}.${log.episodeStart ? ` Reported onset: ${formatTime(new Date(log.episodeStart))}.` : ''}` })
              setSessionToLog(null); setScreen('report')
            } else setScreen('today')
          }} /> }
        {screen === 'report' && <Report state={state} saveError={storageError} initialSessionId={activeSessionId} onReviewSession={(id, revision) => update(current => ({ ...current, sessions: (current.sessions || []).map(session => session.id === id ? { ...session, reviewedRevision: revision } : session) }))} />}
        {screen === 'settings' && (
          <Settings state={state} update={update} saveError={storageRetryAvailable} onEditProfile={() => setScreen('setup')} />
        )}
        </main>
      </div>
      <NavBar current={screen} onChange={next => { if (next === screen) return; setSessionToLog(null); setScreen(next) }} />
    </div>
  )
}

export default App
