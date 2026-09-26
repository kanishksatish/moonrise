import { useEffect, useId, useRef, useState } from 'react'
import pianoUrl from '../assets/audio/fur-elise-v-gao.mp3'
import '../styles/music-player.css'

const API_SCRIPT_ID = 'moonrise-youtube-api'
const CONNECTION_TIMEOUT = 12000
let apiRequest

// This script is loaded only after the caregiver chooses YouTube. Share the
// request across mounts, and leave an existing API-ready callback intact.
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiRequest) return apiRequest
  apiRequest = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    let script = document.getElementById(API_SCRIPT_ID)
    let timer
    function cleanup() {
      clearTimeout(timer)
      script?.removeEventListener('error', failed)
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previousReady
    }
    function failed() {
      cleanup()
      script?.remove()
      apiRequest = undefined
      reject(new Error('YouTube is unavailable'))
    }
    function ready() {
      cleanup()
      if (window.YT?.Player) resolve(window.YT)
      else {
        apiRequest = undefined
        reject(new Error('YouTube is unavailable'))
      }
      previousReady?.()
    }
    window.onYouTubeIframeAPIReady = ready
    if (!script) {
      script = document.createElement('script')
      script.id = API_SCRIPT_ID
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('error', failed, { once: true })
    timer = setTimeout(failed, CONNECTION_TIMEOUT)
  })
  return apiRequest
}

function YouTubePlayer({ song, youtubeId, onPlaying }) {
  const host = useRef(null)
  const callback = useRef(onPlaying)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  useEffect(() => { callback.current = onPlaying }, [onPlaying])

  useEffect(() => {
    const container = host.current
    let cancelled = false
    let failed = false
    let player
    let readyTimer
    function release() {
      clearTimeout(readyTimer)
      try { player?.pauseVideo?.() } catch { /* A failed player may already be gone. */ }
      try { player?.destroy?.() } catch { /* Still remove the local iframe below. */ }
      player = undefined
      container?.replaceChildren()
    }
    function fail(message) {
      if (cancelled || failed) return
      failed = true
      release()
      setError(message)
      setStatus('error')
    }
    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      const frame = document.createElement('iframe')
      const params = new URLSearchParams({
        enablejsapi: '1', origin: window.location.origin,
        playsinline: '1', controls: '1', autoplay: '0', rel: '0',
      })
      frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`
      frame.title = `${song.title} by ${song.artist} — YouTube player`
      frame.className = 'music-player-frame'
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture'
      frame.allowFullscreen = true
      frame.width = '480'
      frame.height = '270'
      container.appendChild(frame)
      readyTimer = setTimeout(() => fail('This song couldn’t connect. Try the piano piece or another song.'), CONNECTION_TIMEOUT)
      try {
        player = new YT.Player(frame, { events: {
          onReady: () => {
            if (cancelled || failed) return
            clearTimeout(readyTimer)
            setStatus('ready')
          },
          onStateChange: ({ data }) => {
            if (cancelled || failed) return
            if (data === 1) {
              clearTimeout(readyTimer)
              setStatus('playing')
              callback.current()
            } else if (data === 2) setStatus('paused')
            else if (data === 0) setStatus('ended')
            else if (data === 3) setStatus('buffering')
          },
          onAutoplayBlocked: () => {
            if (!cancelled && !failed) setStatus('ready')
          },
          onError: ({ data }) => fail(data === 153
            ? 'YouTube couldn’t connect in this browser. The piano piece can play here instead.'
            : 'This recording isn’t available here. Try the piano piece or another song.'),
        } })
      } catch {
        fail('YouTube couldn’t load. Try the piano piece or another song.')
      }
    }).catch(() => fail('YouTube couldn’t connect. Try the piano piece or another song.'))
    return () => {
      cancelled = true
      release()
    }
  }, [song.id, song.title, song.artist, youtubeId])

  const statusText = {
    loading: 'Connecting to YouTube…', ready: 'Press Play in the player when you’re ready.',
    playing: 'Playing here', paused: 'Paused', ended: 'The song has ended.', buffering: 'Loading the song…',
  }[status]
  return (
    <div className="music-player-youtube">
      <div className="music-player-video" ref={host} />
      <p className={`music-player-status${error ? ' music-player-error' : ''}`} role="status">{error || statusText}</p>
    </div>
  )
}

function NativeAudio({ src, label, errorMessage = 'This audio couldn’t load. Try again when connected.' }) {
  const audio = useRef(null)
  const [status, setStatus] = useState('Use the player to begin.')
  useEffect(() => {
    const element = audio.current
    // StrictMode replays effects in development; restore the source after its
    // cleanup as well as when a different local recording is selected.
    element.src = src
    return () => {
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }, [src])
  return (
    <div className="music-player-native">
      <audio
        ref={audio} src={src} controls preload="none" crossOrigin="anonymous"
        aria-label={label}
        onPlaying={() => setStatus('Playing here')}
        onPause={() => setStatus('Paused')}
        onEnded={() => setStatus('The piece has ended.')}
        onError={() => setStatus(errorMessage)}
      />
      <p className="music-player-status" role="status">{status}</p>
    </div>
  )
}

function ClassicalPlayer() {
  return (
    <div className="music-player-classical">
      <NativeAudio src={pianoUrl} label="Für Elise, piano performed by V Gao" />
      <p className="music-player-note">A classical alternative, separate from their era songs.</p>
      <details className="music-player-details">
        <summary>About this recording</summary>
        <p>Beethoven’s Für Elise, performed by V Gao in 2006. Included in Moonrise under a public-domain dedication.</p>
        <p><a href="https://commons.wikimedia.org/wiki/File:FurElise.ogg">Recording source</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 license</a></p>
      </details>
    </div>
  )
}

function MusicSelection({ song, youtubeId, onPlaying, onNext }) {
  const [source, setSource] = useState('choice')
  const [localFile, setLocalFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const fileInput = useRef(null)
  const titleId = useId()
  // IDs are curated by the parent; never turn a search URL into an embed URL.
  const canEmbed = Boolean(song?.id && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId || ''))
  const classical = source === 'classical'
  const local = source === 'local' && localFile
  const title = local ? 'Your own recording' : classical ? 'Für Elise' : song?.title || 'A little music'
  const artist = local ? localFile.name : classical ? 'Beethoven · piano by V Gao' : song ? `${song.artist}, ${song.year}` : 'Choose a recording to share.'
  useEffect(() => {
    if (!localFile) return
    return () => URL.revokeObjectURL(localFile.url)
  }, [localFile])
  function chooseSource(next) {
    setSource(next)
    setFileError('')
    if (next !== 'local') setLocalFile(null)
  }
  function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // Choosing the same file again can retry a failed load.
    if (!file) return
    if (!file.size || (!file.type.startsWith('audio/') && !/\.(mp3|m4a|m4b|aac|wav|ogg|oga|opus|flac)$/i.test(file.name))) {
      setFileError('Choose a non-empty audio file, such as MP3, M4A, or WAV.')
      return
    }
    try {
      const url = URL.createObjectURL(file)
      setLocalFile({ url, name: file.name })
      setSource('local')
      setFileError('')
    } catch {
      setFileError('This file couldn’t open. Please choose it again or try another recording.')
    }
  }
  function next() {
    chooseSource('choice')
    onNext?.()
  }
  return (
    <section className="music-player" aria-labelledby={titleId}>
      <div className="music-player-heading">
        <span className="music-player-record" aria-hidden="true"><i /></span>
        <p className="music-player-eyebrow">{local ? 'Music from your device' : classical ? 'A piano interlude' : 'A song to share'}<span>{local ? 'Stays on this device' : classical ? 'Included in Moonrise' : 'Listen together, right here'}</span></p>
      </div>
      <h2 className="music-player-title" id={titleId}>{title}</h2>
      <p className="music-player-artist">{artist}</p>

      {source === 'youtube' && <YouTubePlayer song={song} youtubeId={youtubeId} onPlaying={onPlaying} />}
      {classical && <ClassicalPlayer />}
      {local && <>
        <NativeAudio key={localFile.url} src={localFile.url} label={`Your audio file: ${localFile.name}`} errorMessage="This file couldn’t play. Choose another recording, such as an MP3." />
        <p className="music-player-note">No upload. This recording stays separate from the songs in your evening log.</p>
      </>}
      {source === 'choice' && (
        <>
          {!canEmbed && <p className="music-player-note">{song ? 'An in-app recording of this song isn’t available yet.' : 'Music starts only when you choose Play.'}</p>}
          {canEmbed && <p className="music-player-note">YouTube connects only when you load the player. Ads may appear.</p>}
        </>
      )}

      <div className="music-player-actions">
        {canEmbed && source !== 'youtube' && <button type="button" className="music-player-button music-player-primary" onClick={() => chooseSource('youtube')}>{classical || local ? 'Back to their song' : 'Load YouTube player'} <span aria-hidden="true">▷</span></button>}
        {!classical && <button type="button" className={`music-player-button${!canEmbed ? ' music-player-primary' : ''}`} onClick={() => chooseSource('classical')}>Choose piano instead</button>}
        <button type="button" className="music-player-button" onClick={() => fileInput.current?.click()}>{local ? 'Choose another file' : 'Play a music file'}</button>
        <input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.m4a,.m4b,.aac,.wav,.ogg,.oga,.opus,.flac" aria-label="Choose an audio file from your device" onChange={chooseFile} />
        {onNext && <button type="button" className="music-player-button music-player-next" onClick={next}>Next song <span aria-hidden="true">→</span></button>}
      </div>
      {fileError && <p className="music-player-error music-player-status" role="alert">{fileError}</p>}
      {!classical && !local && canEmbed && (
        <details className="music-player-details">
          <summary>About YouTube playback</summary>
          <p>Loading the player connects to YouTube and Google, which receive playback and device information and may use cookies. Privacy-enhanced mode limits personalization; it does not remove all data sharing. Moonrise sends no name, care notes, or evening logs.</p>
          <p>By loading YouTube, you agree to the <a href="https://www.youtube.com/t/terms">YouTube terms</a>. See the <a href="https://policies.google.com/privacy">Google privacy policy</a>.</p>
        </details>
      )}
    </section>
  )
}

/**
 * Full music card. youtubeId must identify a recording checked by the integrator.
 * sessionId stays stable for one routine; supply playedSongIds from that routine
 * when this card can remount. active=false stops/unmounts either media source.
 * onPlayed(song.id) fires only for observed YouTube PLAYING, once per song/session.
 * Bundled piano and user-selected local files never call the era-song callback.
 */
export default function MusicPlayer({ song, youtubeId, onPlayed, onNext, sessionId = 'current', playedSongIds = [], active = true }) {
  const played = useRef({ sessionId, ids: new Set() })
  if (played.current.sessionId !== sessionId) played.current = { sessionId, ids: new Set() }
  function observedPlaying() {
    if (!song?.id || played.current.ids.has(song.id) || playedSongIds.includes(song.id)) return
    played.current.ids.add(song.id)
    onPlayed?.(song.id)
  }
  return active ? (
    <MusicSelection
      key={`${sessionId}:${song?.id || 'classical'}:${youtubeId || ''}`}
      song={song} youtubeId={youtubeId} onPlaying={observedPlaying} onNext={onNext}
    />
  ) : null
}
