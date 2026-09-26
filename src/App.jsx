import { useEffect, useState } from 'react'
import { effectiveDusk, loadState, saveState } from './engine/index.js'
import { todayString } from './components/format.js'
import NavBar from './components/NavBar.jsx'
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
  const profile = state.profile

  // Every change to state is saved right away.
  function update(next) {
    setState(next)
    saveState(next)
  }

  // Tonight's effective dusk, refreshed every 30 minutes (weather changes, and the day rolls over).
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function refresh() {
      const result = await effectiveDusk(new Date(), profile.lat, profile.lon)
      if (!cancelled) setSky({ ...result, date: todayString() })
    }
    refresh()
    const id = setInterval(refresh, SKY_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [profile])

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

  if (screen === 'moonrise') {
    return (
      <Moonrise
        state={state}
        onPlayed={(songId) => {
          const today = todayString()
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
      <div className="screen">
        {screen === 'today' && <Today state={state} sky={sky} onStart={() => setScreen('moonrise')} />}
        {screen === 'log' && <Log state={state} sky={sky} update={update} onDone={() => setScreen('today')} />}
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
