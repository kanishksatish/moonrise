import { useEffect, useState } from 'react'
import {
  memoryPrompts,
  playlist,
  promptAt,
  skyState,
  spotifySearchUrl,
  youtubeSearchUrl,
} from '../engine/index.js'
import useNow from '../components/useNow.js'

// The moon climbs from below the horizon to high in the sky over this many minutes.
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

export default function Moonrise({ state, onPlayed, onExit }) {
  const { profile, logs } = state
  const now = useNow(10000)
  const [startedAt] = useState(() => Date.now())
  const [songs] = useState(() => playlist(profile.birthYear, logs))
  const [songIndex, setSongIndex] = useState(0)
  const song = songs.length ? songs[songIndex % songs.length] : null

  const sky = skyState(now, profile.lat, profile.lon)
  const elapsed = now.getTime() - startedAt
  const moonProgress = Math.min(1, elapsed / (MOON_RISE_MINUTES * 60000))
  const prompt = promptAt(memoryPrompts(profile, { song }), elapsed)
  // Warm lamp light rises from the bottom of the screen as the real sky darkens.
  const glow = 0.15 + 0.6 * sky.warmth

  useEffect(() => {
    enterFullscreen()
    let lock = null
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      lock?.release().catch(() => {})
      exitFullscreen()
    }
  }, [])

  return (
    <div
      className="moonrise"
      style={{ background: `linear-gradient(to bottom, ${sky.gradient.top}, ${sky.gradient.bottom})` }}
    >
      <div className="stars" style={{ opacity: Math.max(0, sky.darkness - 0.3) }} aria-hidden="true">
        {STARS.map((s, i) => (
          <span key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }} />
        ))}
      </div>
      <div
        className="moon"
        aria-hidden="true"
        style={{ bottom: `${-12 + moonProgress * 72}%`, left: `${15 + moonProgress * 50}%` }}
      />
      <div
        className="lamp-glow"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse at 50% 115%, rgba(255, 170, 90, ${glow}) 0%, rgba(255, 170, 90, 0) 70%)`,
          filter: `brightness(${sky.brightness * 1.2})`,
        }}
      />

      <button className="btn finish" onClick={onExit}>
        Finish
      </button>

      <div className="moonrise-content">
        {prompt && (
          <div className="prompt">
            <p className="prompt-label">Read aloud</p>
            <p className="prompt-text">{prompt}</p>
          </div>
        )}

        {song ? (
          <div className="song">
            <p className="song-title">{song.title}</p>
            <p className="song-artist">
              {song.artist}, {song.year}
            </p>
            <div className="song-actions">
              <a className="btn play" href={spotifySearchUrl(song)} onClick={() => onPlayed(song.id)} target="_blank" rel="noreferrer">
                ▶ Spotify
              </a>
              <a className="btn play" href={youtubeSearchUrl(song)} onClick={() => onPlayed(song.id)} target="_blank" rel="noreferrer">
                ▶ YouTube
              </a>
              <button className="btn" onClick={() => setSongIndex((i) => i + 1)}>
                Next song
              </button>
            </div>
          </div>
        ) : (
          <p className="song-artist">No songs from their era in the list yet.</p>
        )}
      </div>
    </div>
  )
}
