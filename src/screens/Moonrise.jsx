import { useEffect, useId, useState } from 'react'
import {
  memoryPrompts,
  moonPhase,
  playlist,
  promptAt,
  skyState,
  songVideo,
} from '../engine/index.js'
import useNow from '../components/useNow.js'
import MoonIcon from '../components/MoonIcon.jsx'
import Brand from '../components/Brand.jsx'
import MusicPlayer from '../components/MusicPlayer.jsx'
import { eveningKey } from '../components/eveningLog.js'
import '../styles/session-experience.css'

// A stylized, always-visible rise inside the art stage, separate from the controls.
const MOON_RISE_MINUTES = 60

// Stars are fixed so they don't jump around between renders.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 60,
  size: 2 + (i % 3),
}))

async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.()
  } catch {
    // Not allowed here; the screen still works without it.
  }
}

async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // ignore
  }
}

export default function Moonrise({ state, onPlayed, onExit, saveError = false }) {
  const { profile, logs } = state
  const now = useNow(10000)
  const [startedAt] = useState(() => Date.now())
  // Only offer an era title when there is a verified playable source. The
  // included library is separate and is available for every birth year.
  const [songs] = useState(() => playlist(profile.birthYear, logs).filter(item => songVideo(item.id)))
  const [songIndex, setSongIndex] = useState(0)
  const [promptOffset, setPromptOffset] = useState(0)
  const [quiet, setQuiet] = useState(false)
  const quietHelp = useId()
  const song = songs.length ? songs[songIndex % songs.length] : null
  const video = song ? songVideo(song.id) : null
  const playedSongIds = state.tonight?.date === eveningKey(now) && Array.isArray(state.tonight.songIds) ? state.tonight.songIds : []

  const sky = skyState(now, profile.lat, profile.lon)
  const moon = moonPhase(now)
  const elapsed = now.getTime() - startedAt
  const moonProgress = Math.max(0, Math.min(1, elapsed / (MOON_RISE_MINUTES * 60000)))
  // Conversation remains independent of the player: a bundled or personal
  // recording must never be introduced as an unrelated era-catalog song.
  const prompt = promptAt(memoryPrompts(profile, { approved: state.approvedPrompts }), elapsed + promptOffset * 3 * 60000)
  // Warm lamp light rises from the bottom of the screen as the real sky darkens.
  const glow = 0.15 + 0.6 * sky.warmth

  useEffect(() => {
    let lock = null
    let disposed = false
    async function release(sentinel) {
      try { await sentinel?.release() } catch { /* Unsupported or already released. */ }
    }
    async function keepScreenAwake() {
      try {
        const acquired = await navigator.wakeLock?.request?.('screen')
        // A browser may resolve permission after this routine has already ended.
        if (disposed) await release(acquired)
        else lock = acquired
      } catch { /* The routine remains usable without wake lock. */ }
    }
    keepScreenAwake()
    return () => {
      disposed = true
      release(lock)
      exitFullscreen()
    }
  }, [])

  return (
    <div
      className={`moonrise session-experience${quiet ? ' quiet-view' : ''}`}
      style={{ background: `linear-gradient(to bottom, ${sky.gradient.top}, ${sky.gradient.bottom})` }}
    >
      <div className="stars" style={{ opacity: Math.max(0, sky.darkness - 0.3) }} aria-hidden="true">
        {STARS.map((s, i) => (
          <span key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }} />
        ))}
      </div>
      <div
        className="lamp-glow"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 115%, rgba(255, 170, 90, ${glow}) 0%, rgba(255, 170, 90, 0) 70%)`,
          filter: `brightness(${sky.brightness * 1.2})`,
        }}
      />

      <header className="session-header">
        <Brand />
        <div className="session-tools">
          {document.documentElement.requestFullscreen && <button className="btn fullscreen-toggle" onClick={enterFullscreen}>Full screen</button>}
          <button className="btn quiet-toggle" autoFocus aria-describedby={quietHelp} aria-pressed={quiet} onClick={() => setQuiet(current => !current)}>{quiet ? 'Show conversation' : 'Quiet view'}</button>
          <button className="btn finish" onClick={onExit}>Finish <span aria-hidden="true">↗</span></button>
        </div>
        <p className="sr-only" id={quietHelp}>{quiet ? 'Returns to music and conversation. Music will not restart automatically.' : 'Stops music and hides the conversation for quiet company.'}</p>
      </header>
      {saveError && <p className="session-save-error" role="alert">This device could not save your changes. Keep this page open; changes may be lost when you close it.</p>}

      <div className="moonrise-content">
        <div className="session-scene">
          <div className="session-intro">
            <p className="eyebrow">An evening with {profile.name}</p>
            <h1 className="session-title">A moment,<br/><em>together.</em></h1>
          </div>
          <div className="session-sky" aria-hidden="true">
            <div className="session-moon" style={{ '--moon-progress': moonProgress }}><MoonIcon phase={moon.phase} decorative/></div>
            <div className="session-orbit"/>
            <div className="session-reflection"/>
          </div>
          <p className="session-caption">Follow their lead.{' '}<br/>Quiet company is welcome.</p>
          {quiet && <p className="session-quiet-note" role="status">Music is stopped. Stay as long as you like.</p>}
        </div>
        {!quiet && <div className="session-cards">
          <MusicPlayer
            song={song} youtubeId={video?.youtubeId} onPlayed={onPlayed}
            onNext={songs.length > 1 ? () => setSongIndex(i => i + 1) : undefined}
            sessionId={startedAt} playedSongIds={playedSongIds}
          />
          {prompt && (
            <section className="prompt" aria-label="Conversation starter">
              <div className="session-prompt-heading">
                <span className="prompt-quote" aria-hidden="true">“</span>
                <p className="prompt-label">Conversation starter</p>
              </div>
              <div aria-live="polite" aria-atomic="true"><p className="prompt-text" key={prompt}>{prompt}</p></div>
              <div className="session-prompt-footer">
                <p>Share a little. Listen a little.</p>
                <button className="text-action" onClick={() => setPromptOffset(index => index + 1)}>Next prompt <span aria-hidden="true">→</span></button>
              </div>
            </section>
          )}
        </div>}
      </div>
    </div>
  )
}
