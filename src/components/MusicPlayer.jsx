import { useEffect, useId, useRef, useState } from 'react'
import { bundledMusic } from './bundledMusic.js'
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
      readyTimer = setTimeout(() => fail('This song couldn’t connect. Choose an included recording instead.'), CONNECTION_TIMEOUT)
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
            ? 'YouTube couldn’t connect in this browser. The included recordings can play here instead.'
            : 'This recording isn’t available here. Choose an included recording instead.'),
        } })
      } catch {
        fail('YouTube couldn’t load. Choose an included recording instead.')
      }
    }).catch(() => fail('YouTube couldn’t connect. Choose an included recording instead.'))
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

function NativeAudio({ src, label, onPlaying, errorMessage = 'This audio couldn’t load. Try again when connected.' }) {
  const audio = useRef(null)
  const [status, setStatus] = useState('Use the player to begin.')
  useEffect(() => {
    const element = audio.current
    // StrictMode replays effects in development; restore the source after its
    // cleanup as well as when a different local recording is selected.
    element.src = src
    setStatus('Use the player to begin.')
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
        onPlaying={() => { setStatus('Playing here'); onPlaying?.() }}
        onPause={() => setStatus('Paused')}
        onEnded={() => setStatus('The piece has ended.')}
        onError={() => setStatus(errorMessage)}
      />
      <p className="music-player-status" role="status">{status}</p>
    </div>
  )
}

function IncludedPlayer({ recording, onPlaying }) {
  return (
    <div className="music-player-included">
      <NativeAudio key={recording.id} src={recording.src} label={`${recording.title} — ${recording.artist}`} onPlaying={() => onPlaying(recording.id)} />
      <details className="music-player-details">
        <summary>About this recording</summary>
        <p>This included collection is available to everyone; it is not personalized to a birth year or music history. Playback is recorded under this recording’s own title.</p>
        <p>Keep Moonrise open online for its first download. The full included library can then play offline while this browser keeps its site data.</p>
        <p>{recording.attribution}</p>
        <p>{recording.recordingYear ? `Recorded in ${recording.recordingYear}. ` : ''}{recording.licenseName}.</p>
        <p><a href={recording.sourceUrl} target="_blank" rel="noreferrer">Recording source</a> · <a href={recording.licenseUrl} target="_blank" rel="noreferrer">Use and license details</a></p>
      </details>
    </div>
  )
}

function MusicSelection({ song, youtubeId, onPlaying, onIncludedPlaying, onNext, recordings }) {
  const [source, setSource] = useState('included')
  const [recordingId, setRecordingId] = useState(recordings[0].id)
  const [localFile, setLocalFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const fileInput = useRef(null)
  const titleId = useId()
  const pickerId = useId()
  // IDs are curated by the parent; never turn a search URL into an embed URL.
  const canEmbed = Boolean(song?.id && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId || ''))
  const included = source === 'included' || (source === 'youtube' && !canEmbed)
  const local = source === 'local' && localFile
  const recording = recordings.find(item => item.id === recordingId) || recordings[0]
  const title = local ? 'Your own recording' : included ? recording.title : song.title
  const artist = local ? localFile.name : included ? recording.artist : `${song.artist}, ${song.year}`
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
    onNext?.()
  }
  function chooseRecording(id) {
    setRecordingId(id)
    chooseSource('included')
  }
  return (
    <section className="music-player" aria-labelledby={titleId}>
      <div className="music-player-heading">
        <span className="music-player-record" aria-hidden="true"><i /></span>
        <p className="music-player-eyebrow">{local ? 'Music from your device' : included ? 'The listening library' : 'A song to share'}<span>{local ? 'Stays on this device' : included ? `${recordings.length} included recording${recordings.length === 1 ? '' : 's'}` : 'Listen together, right here'}</span></p>
      </div>
      <div className="music-player-picker">
        <label htmlFor={pickerId}>Choose an included recording</label>
        <select id={pickerId} value={included ? recording.id : ''} onChange={event => chooseRecording(event.target.value)}>
          {!included && <option value="" disabled>Choose from the listening library</option>}
          {recordings.map(item => <option key={item.id} value={item.id}>{item.title} — {item.artist}</option>)}
        </select>
        <p className="music-player-note">Choose a track, then press Play. Available offline after downloading.</p>
      </div>
      <h2 className="music-player-title" id={titleId}>{title}</h2>
      <p className="music-player-artist">{artist}</p>

      {source === 'youtube' && canEmbed && <YouTubePlayer key={`${song.id}:${youtubeId}`} song={song} youtubeId={youtubeId} onPlaying={onPlaying} />}
      {included && <IncludedPlayer recording={recording} onPlaying={onIncludedPlaying} />}
      {local && <>
        <NativeAudio key={localFile.url} src={localFile.url} label={`Your audio file: ${localFile.name}`} errorMessage="This file couldn’t play. Choose another recording, such as an MP3." />
        <p className="music-player-note">No upload. This recording stays separate from the songs in your evening log.</p>
      </>}
      <div className="music-player-actions">
        {!included && <button type="button" className="music-player-button music-player-primary" onClick={() => chooseSource('included')}>Back to included recordings</button>}
        {included && recordings.length > 1 && <button type="button" className="music-player-button" onClick={() => chooseRecording(recordings[(recordings.indexOf(recording) + 1) % recordings.length].id)}>Next included recording <span aria-hidden="true">→</span></button>}
        <button type="button" className="music-player-button" onClick={() => fileInput.current?.click()}>{local ? 'Choose another file' : 'Play a music file'}</button>
        <input ref={fileInput} hidden type="file" accept="audio/*,.mp3,.m4a,.m4b,.aac,.wav,.ogg,.oga,.opus,.flac" aria-label="Choose an audio file from your device" onChange={chooseFile} />
      </div>
      {fileError && <p className="music-player-error music-player-status" role="alert">{fileError}</p>}
      {canEmbed && (
        <details className="music-player-details">
          <summary>Optional YouTube song</summary>
          {source !== 'youtube' && <button type="button" className="music-player-button" onClick={() => chooseSource('youtube')}>Load YouTube player: {song.title}</button>}
          {source === 'youtube' && onNext && <button type="button" className="music-player-button" onClick={next}>Next YouTube song</button>}
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
 * onPlayed(id) fires only for observed playback, once per recording/session.
 * Bundled IDs are separate from era-song IDs. Personal files are never assigned
 * a catalog ID, and historical piano/file activity is never reconstructed.
 */
export default function MusicPlayer({ song, youtubeId, onPlayed, onNext, sessionId = 'current', playedSongIds = [], active = true, recordings = bundledMusic }) {
  const played = useRef({ sessionId, ids: new Set() })
  if (played.current.sessionId !== sessionId) played.current = { sessionId, ids: new Set() }
  function observedPlaying(id) {
    if (!id || played.current.ids.has(id) || playedSongIds.includes(id)) return
    played.current.ids.add(id)
    onPlayed?.(id)
  }
  return active ? (
    <MusicSelection
      key={sessionId}
      song={song} youtubeId={youtubeId} onPlaying={() => observedPlaying(song?.id)}
      onIncludedPlaying={observedPlaying} onNext={onNext} recordings={recordings}
    />
  ) : null
}
