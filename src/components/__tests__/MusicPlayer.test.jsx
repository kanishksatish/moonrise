// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import MusicPlayer from '../MusicPlayer.jsx'
import { bundledMusic } from '../bundledMusic.js'

const firstSong = { id: 'stand-by-me-1961', title: 'Stand By Me', artist: 'Ben E. King', year: 1961 }
const secondSong = { id: 'what-a-wonderful-world-1967', title: 'What a Wonderful World', artist: 'Louis Armstrong', year: 1967 }
const firstId = 'TJx9E-rUqhg'
const secondId = 'rBrd_3VMC3c'
let players
let pauseAudio
let loadAudio
const NativeURL = URL

beforeEach(() => {
  vi.useFakeTimers()
  players = []
  class MockPlayer {
    constructor(frame, options) {
      this.frame = frame
      this.events = options.events
      this.pauseVideo = vi.fn()
      this.destroy = vi.fn()
      this.playVideo = vi.fn()
      players.push(this)
    }
  }
  vi.stubGlobal('YT', { Player: MockPlayer })
  let objectUrlCount = 0
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL = vi.fn(() => `blob:http://localhost/local-audio-${++objectUrlCount}`)
    static revokeObjectURL = vi.fn()
  })
  pauseAudio = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.getElementById('moonrise-youtube-api')?.remove()
  delete window.onYouTubeIframeAPIReady
})

function chooseYouTube() {
  const details = screen.getByText('Optional YouTube song').closest('details')
  details.open = true
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player/ }))
}

async function loadYouTube() {
  chooseYouTube()
  await act(async () => {})
  return players.at(-1)
}

function state(player, data) {
  act(() => player.events.onStateChange({ data, target: player }))
}

it('contacts no media provider before an explicit choice and rejects search URLs as IDs', () => {
  const onPlayed = vi.fn()
  const { rerender } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.querySelector('audio').autoplay).toBe(false)
  expect(document.querySelector('audio').preload).toBe('metadata')
  expect(document.getElementById('moonrise-youtube-api')).toBeNull()
  expect(onPlayed).not.toHaveBeenCalled()
  rerender(<MusicPlayer song={firstSong} youtubeId="https://youtube.com/results?search_query=stand+by+me" onPlayed={onPlayed} />)
  expect(screen.queryByRole('button', { name: /Load YouTube/ })).toBeNull()
  expect(screen.queryByText(/in-app recording of this song isn’t available/)).toBeNull()
  expect(screen.getByRole('combobox', { name: 'Choose an included recording' })).toBeTruthy()
  expect(screen.queryByText('Stand By Me')).toBeNull()
})

it('uses a visible private-enhanced inline embed and records actual PLAYING only once', async () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} sessionId="evening-1" />)
  const player = await loadYouTube()
  const frame = document.querySelector('iframe')
  const url = new URL(frame.src)
  expect(url.origin).toBe('https://www.youtube-nocookie.com')
  expect(url.pathname).toBe(`/embed/${firstId}`)
  expect(url.searchParams.get('origin')).toBe(window.location.origin)
  expect(url.searchParams.get('autoplay')).toBe('0')
  expect(url.searchParams.get('playsinline')).toBe('1')
  expect(url.searchParams.get('controls')).toBe('1')
  expect(frame.referrerPolicy).toBe('strict-origin-when-cross-origin')
  expect(frame.title).toContain('Stand By Me by Ben E. King')
  expect(Number(frame.width)).toBeGreaterThanOrEqual(200)
  expect(Number(frame.height)).toBeGreaterThanOrEqual(200)
  act(() => player.events.onReady({ target: player }))
  state(player, 5)
  state(player, 3)
  expect(player.playVideo).not.toHaveBeenCalled()
  expect(onPlayed).not.toHaveBeenCalled()
  state(player, 1)
  state(player, 2)
  state(player, 1)
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(firstSong.id)
})

it('cleans up on song changes and ignores old player events', async () => {
  const onPlayed = vi.fn()
  const { rerender, unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  const first = await loadYouTube()
  rerender(<MusicPlayer song={secondSong} youtubeId={secondId} onPlayed={onPlayed} />)
  expect(first.pauseVideo).toHaveBeenCalledOnce()
  expect(first.destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
  state(first, 1)
  expect(onPlayed).not.toHaveBeenCalled()
  await act(async () => {})
  const second = players.at(-1)
  state(second, 1)
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(secondSong.id)
  unmount()
  expect(second.destroy).toHaveBeenCalledOnce()
  state(second, 1)
  expect(onPlayed).toHaveBeenCalledOnce()
})

it('stops for quiet mode and deduplicates resumed songs until a new session', async () => {
  const onPlayed = vi.fn()
  const props = { song: firstSong, youtubeId: firstId, onPlayed, sessionId: 'session-a' }
  const { rerender } = render(<MusicPlayer {...props} />)
  const first = await loadYouTube()
  state(first, 1)
  rerender(<MusicPlayer {...props} active={false} />)
  expect(first.destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
  rerender(<MusicPlayer {...props} />)
  state(await loadYouTube(), 1)
  expect(onPlayed).toHaveBeenCalledOnce()
  rerender(<MusicPlayer {...props} sessionId="session-b" />)
  state(await loadYouTube(), 1)
  expect(onPlayed).toHaveBeenCalledTimes(2)
})

it('falls back to the included library if a previously selected YouTube source is removed', async () => {
  const { rerender } = render(<MusicPlayer song={firstSong} youtubeId={firstId} />)
  const player = await loadYouTube()
  rerender(<MusicPlayer />)
  expect(player.destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.querySelector('audio')).toBeTruthy()
  expect(screen.getByRole('heading', { name: bundledMusic[0].title })).toBeTruthy()
})

it('honors played IDs after remount and observes the latest callback without restarting playback', async () => {
  const oldCallback = vi.fn()
  const newCallback = vi.fn()
  const { rerender, unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={oldCallback} />)
  const player = await loadYouTube()
  rerender(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={newCallback} />)
  state(player, 1)
  expect(players).toHaveLength(1)
  expect(oldCallback).not.toHaveBeenCalled()
  expect(newCallback).toHaveBeenCalledExactlyOnceWith(firstSong.id)
  unmount()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={newCallback} playedSongIds={[firstSong.id]} />)
  state(await loadYouTube(), 1)
  expect(newCallback).toHaveBeenCalledOnce()
})

it('destroys a rejected embed, offers piano/Next, and never counts failed or blocked playback', async () => {
  const onPlayed = vi.fn()
  const onNext = vi.fn()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} onNext={onNext} />)
  const player = await loadYouTube()
  act(() => player.events.onAutoplayBlocked())
  expect(screen.getByRole('status').textContent).toMatch(/Press Play/)
  expect(onPlayed).not.toHaveBeenCalled()
  act(() => player.events.onError({ data: 150 }))
  expect(screen.getByRole('status').textContent).toMatch(/recording isn’t available/)
  expect(player.destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
  state(player, 1)
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Next YouTube song/ }))
  expect(onNext).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Back to included recordings' })).toBeTruthy()
})

it('provides honest native piano controls without assigning the era song’s outcome', async () => {
  const onPlayed = vi.fn()
  const { unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  const player = await loadYouTube()
  fireEvent.click(screen.getByRole('button', { name: 'Back to included recordings' }))
  const audio = screen.getByLabelText(/Für Elise —/)
  expect(screen.getByRole('heading', { name: 'Für Elise' })).toBeTruthy()
  expect(audio.controls).toBe(true)
  expect(audio.autoplay).toBe(false)
  expect(audio.preload).toBe('metadata')
  expect(audio.src).toMatch(/fur-elise-v-gao\.mp3/)
  expect(document.querySelector('iframe')).toBeNull()
  expect(player.destroy).toHaveBeenCalledOnce()
  fireEvent.playing(audio)
  expect(screen.getByRole('status').textContent).toBe('Playing here')
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(bundledMusic[0].id)
  chooseYouTube()
  await act(async () => {})
  expect(document.querySelector('audio')).toBeNull()
  expect(pauseAudio).toHaveBeenCalledTimes(2)
  expect(loadAudio).toHaveBeenCalledTimes(2)
  expect(audio.getAttribute('src')).toBeNull()
  unmount()
  expect(players.at(-1).destroy).toHaveBeenCalledOnce()
})

it('offers a local recording without any era song and reports native audio failures', () => {
  render(<MusicPlayer />)
  const audio = screen.getByLabelText(/Für Elise —/)
  fireEvent.error(audio)
  expect(screen.getByRole('status').textContent).toMatch(/audio couldn’t load/)
  expect(screen.queryByRole('button', { name: /Load YouTube player/ })).toBeNull()
})

it('keeps native piano playable after StrictMode replays setup and cleanup', () => {
  render(<StrictMode><MusicPlayer /></StrictMode>)
  const audio = screen.getByLabelText(/Für Elise —/)
  expect(audio.getAttribute('src')).toMatch(/fur-elise-v-gao\.mp3/)
  expect(audio.crossOrigin).toBe('anonymous')
})

it('shows the entire included library and switches the real source without autoplay or era-song logging', () => {
  const onPlayed = vi.fn()
  const recordings = [bundledMusic[0], {
    ...bundledMusic[0], id: 'bundled-test-second', title: 'A second recording',
    artist: 'Another performer', src: '/second-recording.mp3', recordingYear: null,
  }]
  render(<MusicPlayer song={firstSong} onPlayed={onPlayed} recordings={recordings} />)
  const picker = screen.getByRole('combobox', { name: 'Choose an included recording' })
  expect(screen.getAllByRole('option')).toHaveLength(2)
  expect(picker.value).toBe(recordings[0].id)
  const firstAudio = document.querySelector('audio')
  firstAudio.currentTime = 31
  fireEvent.playing(firstAudio)
  fireEvent.change(picker, { target: { value: recordings[1].id } })
  const nextAudio = screen.getByLabelText('A second recording — Another performer')
  expect(firstAudio.getAttribute('src')).toBeNull()
  expect(pauseAudio).toHaveBeenCalledOnce()
  expect(nextAudio.src).toContain('/second-recording.mp3')
  expect(nextAudio.currentTime).toBe(0)
  expect(nextAudio.autoplay).toBe(false)
  expect(nextAudio.controls).toBe(true)
  expect(screen.getByRole('heading', { name: 'A second recording' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Use the player to begin.')
  fireEvent.playing(nextAudio)
  expect(onPlayed.mock.calls).toEqual([[recordings[0].id], [recordings[1].id]])
  fireEvent.click(screen.getByRole('button', { name: /Next included recording/ }))
  expect(picker.value).toBe(recordings[0].id)
  expect(screen.getByRole('heading', { name: recordings[0].title })).toBeTruthy()
})

it('stops included audio for quiet mode and keeps source and attribution paired', () => {
  const { rerender } = render(<MusicPlayer />)
  const audio = document.querySelector('audio')
  fireEvent.playing(audio)
  const details = screen.getByText('About this recording').closest('details')
  details.open = true
  expect(screen.getByRole('link', { name: 'Recording source' }).href).toBe(bundledMusic[0].sourceUrl)
  expect(screen.getByRole('link', { name: 'Use and license details' }).href).toBe(bundledMusic[0].licenseUrl)
  rerender(<MusicPlayer active={false} />)
  expect(document.querySelector('audio')).toBeNull()
  expect(audio.getAttribute('src')).toBeNull()
  expect(pauseAudio).toHaveBeenCalledOnce()
})

it('makes every shipped recording selectable and logs its own ID only after playback', () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer onPlayed={onPlayed} />)
  const picker = screen.getByRole('combobox', { name: 'Choose an included recording' })
  expect(screen.getAllByRole('option')).toHaveLength(bundledMusic.length)
  for (const [index, recording] of bundledMusic.entries()) {
    fireEvent.change(picker, { target: { value: recording.id } })
    const audio = screen.getByLabelText(`${recording.title} — ${recording.artist}`)
    expect(audio.src).toContain(recording.filename)
    expect(audio.autoplay).toBe(false)
    expect(onPlayed).toHaveBeenCalledTimes(index)
    fireEvent.playing(audio)
    expect(onPlayed).toHaveBeenLastCalledWith(recording.id)
  }
  expect(onPlayed.mock.calls.flat()).toEqual(bundledMusic.map(item => item.id))
})

it('records each included track only on playing, once per session, honoring saved IDs after remount', () => {
  const onPlayed = vi.fn()
  const { rerender, unmount } = render(<MusicPlayer onPlayed={onPlayed} sessionId="a" />)
  const audio = document.querySelector('audio')
  fireEvent.loadStart(audio)
  fireEvent.loadedMetadata(audio)
  fireEvent.canPlay(audio)
  fireEvent.error(audio)
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.playing(audio)
  fireEvent.pause(audio)
  fireEvent.playing(audio)
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(bundledMusic[0].id)
  rerender(<MusicPlayer onPlayed={onPlayed} sessionId="a" active={false} />)
  rerender(<MusicPlayer onPlayed={onPlayed} sessionId="a" />)
  fireEvent.playing(document.querySelector('audio'))
  expect(onPlayed).toHaveBeenCalledOnce()
  rerender(<MusicPlayer onPlayed={onPlayed} sessionId="b" />)
  fireEvent.playing(document.querySelector('audio'))
  expect(onPlayed).toHaveBeenCalledTimes(2)
  unmount()
  render(<MusicPlayer onPlayed={onPlayed} sessionId="b" playedSongIds={[bundledMusic[0].id]} />)
  fireEvent.playing(document.querySelector('audio'))
  expect(onPlayed).toHaveBeenCalledTimes(2)
})

it('plays a chosen local file separately, revoking URLs on replacement and exit', async () => {
  const onPlayed = vi.fn()
  const { unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  const youtube = await loadYouTube()
  const input = screen.getByLabelText('Choose an audio file from your device')
  const first = new File(['personal audio'], 'Family piano.mp3', { type: 'audio/mpeg' })
  fireEvent.change(input, { target: { files: [first] } })
  expect(youtube.destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Your own recording' })).toBeTruthy()
  expect(screen.getByText('Family piano.mp3')).toBeTruthy()
  const audio = screen.getByLabelText('Your audio file: Family piano.mp3')
  expect(audio.src).toBe('blob:http://localhost/local-audio-1')
  expect(audio.controls).toBe(true)
  expect(audio.autoplay).toBe(false)
  fireEvent.playing(audio)
  expect(onPlayed).not.toHaveBeenCalled()
  expect(URL.createObjectURL).toHaveBeenCalledWith(first)
  const second = new File(['more audio'], 'Another song.m4a', { type: 'audio/mp4' })
  fireEvent.change(input, { target: { files: [second] } })
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:http://localhost/local-audio-1')
  expect(pauseAudio).toHaveBeenCalledTimes(2)
  expect(document.querySelectorAll('audio')).toHaveLength(1)
  expect(screen.getByLabelText('Your audio file: Another song.m4a').src).toBe('blob:http://localhost/local-audio-2')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-audio-2')
  expect(pauseAudio).toHaveBeenCalledTimes(3)
  expect(onPlayed).not.toHaveBeenCalled()
})

it('clears local audio on quiet mode and on changing to the included piano', () => {
  const { rerender } = render(<MusicPlayer />)
  const select = () => fireEvent.change(screen.getByLabelText('Choose an audio file from your device'), {
    target: { files: [new File(['audio'], 'Song.mp3', { type: 'audio/mpeg' })] },
  })
  select()
  fireEvent.click(screen.getByRole('button', { name: 'Back to included recordings' }))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-audio-1')
  expect(document.querySelectorAll('audio')).toHaveLength(1)
  select()
  rerender(<MusicPlayer active={false} />)
  expect(document.querySelector('audio')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-audio-2')
})

it('reports invalid, unreadable, and unsupported local files without catalog logging', () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer song={firstSong} onPlayed={onPlayed} />)
  const input = screen.getByLabelText('Choose an audio file from your device')
  fireEvent.change(input, { target: { files: [new File(['not audio'], 'Notes.txt', { type: 'text/plain' })] } })
  expect(screen.getByRole('alert').textContent).toMatch(/non-empty audio file/)
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { files: [new File([], 'Empty.mp3', { type: 'audio/mpeg' })] } })
  expect(URL.createObjectURL).not.toHaveBeenCalled()
  URL.createObjectURL.mockImplementationOnce(() => { throw new Error('unreadable') })
  fireEvent.change(input, { target: { files: [new File(['audio'], 'Song.mp3', { type: 'audio/mpeg' })] } })
  expect(screen.getByRole('alert').textContent).toMatch(/file couldn’t open/)
  fireEvent.change(input, { target: { files: [new File(['unsupported'], 'Unknown.flac', { type: 'audio/flac' })] } })
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.error(screen.getByLabelText('Your audio file: Unknown.flac'))
  expect(screen.getByRole('status').textContent).toMatch(/file couldn’t play/)
  expect(onPlayed).not.toHaveBeenCalled()
})

it('recovers from player connection timeouts without recording listening', async () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  const player = await loadYouTube()
  act(() => vi.advanceTimersByTime(12000))
  expect(screen.getByRole('status').textContent).toMatch(/song couldn’t connect/)
  expect(player.destroy).toHaveBeenCalledOnce()
  expect(onPlayed).not.toHaveBeenCalled()
})

it('shows a useful fallback for a browser identification failure', async () => {
  render(<MusicPlayer song={firstSong} youtubeId={firstId} />)
  const player = await loadYouTube()
  act(() => player.events.onError({ data: 153 }))
  expect(screen.getByRole('status').textContent).toMatch(/couldn’t connect in this browser/)
  expect(screen.getByRole('button', { name: 'Back to included recordings' })).toBeTruthy()
})

it('handles a blocked API script and lets the caregiver retry later', async () => {
  delete window.YT
  const onPlayed = vi.fn()
  const { unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  chooseYouTube()
  const script = document.getElementById('moonrise-youtube-api')
  expect(script.src).toBe('https://www.youtube.com/iframe_api')
  await act(async () => fireEvent.error(script))
  expect(screen.getByRole('status').textContent).toMatch(/YouTube couldn’t connect/)
  expect(onPlayed).not.toHaveBeenCalled()
  unmount()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} />)
  chooseYouTube()
  expect(document.getElementById('moonrise-youtube-api')).not.toBe(script)
  await act(async () => vi.advanceTimersByTime(12000))
  expect(screen.getByRole('status').textContent).toMatch(/YouTube couldn’t connect/)
})

it('does not create a late YouTube player after switching to piano while the API loads', async () => {
  const api = window.YT
  delete window.YT
  const previousReady = vi.fn()
  window.onYouTubeIframeAPIReady = previousReady
  const onPlayed = vi.fn()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  chooseYouTube()
  const ready = window.onYouTubeIframeAPIReady
  fireEvent.click(screen.getByRole('button', { name: 'Back to included recordings' }))
  window.YT = api
  await act(async () => ready())
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.querySelector('audio')).toBeTruthy()
  expect(players).toHaveLength(0)
  expect(onPlayed).not.toHaveBeenCalled()
  expect(previousReady).toHaveBeenCalledOnce()
  expect(window.onYouTubeIframeAPIReady).toBe(previousReady)
})


it('provides a clear native Stop control without logging selection, pause or stop as another play', () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer onPlayed={onPlayed} />)
  const audio = document.querySelector('audio')
  const stop = screen.getByRole('button', { name: 'Stop music' })
  expect(stop.disabled).toBe(true)
  fireEvent.play(audio)
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.playing(audio)
  expect(stop.disabled).toBe(false)
  audio.currentTime = 37
  fireEvent.click(stop)
  expect(audio.currentTime).toBe(0)
  expect(pauseAudio).toHaveBeenCalledOnce()
  fireEvent.pause(audio)
  expect(screen.getByRole('status').textContent).toBe('Stopped')
  expect(stop.disabled).toBe(true)
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(bundledMusic[0].id)
  fireEvent.playing(audio)
  expect(stop.disabled).toBe(false)
  expect(onPlayed).toHaveBeenCalledOnce()
})


it('can stop a pending or buffering native play request before any playback is logged', () => {
  const onPlayed = vi.fn()
  render(<MusicPlayer onPlayed={onPlayed} />)
  const audio = document.querySelector('audio')
  const stop = screen.getByRole('button', { name: 'Stop music' })
  fireEvent.play(audio)
  fireEvent.waiting(audio)
  expect(stop.disabled).toBe(false)
  expect(screen.getByRole('status').textContent).toBe('Starting playback…')
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.click(stop)
  expect(pauseAudio).toHaveBeenCalledOnce()
  expect(audio.currentTime).toBe(0)
  fireEvent.pause(audio)
  expect(screen.getByRole('status').textContent).toBe('Stopped')
  expect(stop.disabled).toBe(true)
  expect(onPlayed).not.toHaveBeenCalled()
})
