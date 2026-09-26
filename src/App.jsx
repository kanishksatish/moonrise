import { useEffect, useState } from 'react'
import { effectiveDusk, eveningDate, loadState, moonPhase, saveState } from './engine/index.js'
import { currentSky, eveningKey } from './components/eveningLog.js'
import useNow from './components/useNow.js'
import NavBar from './components/NavBar.jsx'
import Brand from './components/Brand.jsx'
import LaunchSequence from './components/LaunchSequence.jsx'
import Setup from './screens/Setup.jsx'
import Today from './screens/Today.jsx'
import Moonrise from './screens/Moonrise.jsx'
import Log from './screens/Log.jsx'
import Report from './screens/Report.jsx'
import Settings from './screens/Settings.jsx'

const SKY_REFRESH_MS = 30 * 60 * 1000

function App() {
  const [state, setState] = useState(loadState)
  const [screen, setScreen] = useState('today')
  const [sky, setSky] = useState(null)
  const [storageError, setStorageError] = useState(false)
  const profile = state.profile
  const now = useNow()
  const evening = eveningKey(now)
  const visibleSky = profile ? currentSky(sky, profile, now) : null

  useEffect(() => {
    // Each screen starts at its heading, including inside a tablet preview.
    ;(document.scrollingElement || document.documentElement).scrollTop = 0
  }, [screen])

  // Every change to state is saved right away.
  function update(next) {
    setState(next)
    setStorageError(!saveState(next))
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
        onDone={(p) => {
          update({ ...state, profile: p })
          setScreen('today')
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
        onPlayed={(songId) => {
          const today = eveningKey()
          const tonight = state.tonight?.date === today ? state.tonight : { date: today, songIds: [] }
          if (tonight.songIds.includes(songId)) return
          update({ ...state, tonight: { ...tonight, songIds: [...tonight.songIds, songId] } })
        }}
        onExit={() => setScreen('log')}
      />
    )
  }

  return (
    <div className="app">
      <div className={`screen screen-${screen}`}>
        <header className="app-header no-print">
          <Brand />
          <div className="header-note"><span className="status-dot" aria-hidden="true"/>A little calm, every evening.</div>
          <button className="profile-chip" onClick={() => setScreen('settings')} aria-label={`Settings for ${profile.name}`}><span aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase()}</span><span className="profile-name">{profile.name}</span></button>
        </header>
        {storageError && <p className="status" role="alert">This device could not save your changes. Keep this page open; changes may be lost when you close it.</p>}
        {screen === 'today' && <Today state={state} sky={visibleSky} onStart={() => setScreen('launch')} onPersonalize={() => setScreen('settings')} />}
        {screen === 'log' && <Log key={evening} state={state} sky={visibleSky} update={update} onDone={() => setScreen('today')} />}
        {screen === 'report' && <Report state={state} />}
        {screen === 'settings' && (
          <Settings state={state} update={update} onEditProfile={() => setScreen('setup')} />
        )}
      </div>
      <NavBar current={screen} onChange={setScreen} />
    </div>
  )
}

export default App
