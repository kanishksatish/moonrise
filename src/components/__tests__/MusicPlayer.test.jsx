// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import MusicPlayer from '../MusicPlayer.jsx'

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

async function loadYouTube() {
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player|Back to their song/ }))
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
  expect(document.querySelector('audio')).toBeNull()
  expect(document.getElementById('moonrise-youtube-api')).toBeNull()
  expect(onPlayed).not.toHaveBeenCalled()
  rerender(<MusicPlayer song={firstSong} youtubeId="https://youtube.com/results?search_query=stand+by+me" onPlayed={onPlayed} />)
  expect(screen.queryByRole('button', { name: /Load YouTube/ })).toBeNull()
  expect(screen.getByText(/in-app recording of this song isn’t available/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Choose piano instead' })).toBeTruthy()
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
  const second = await loadYouTube()
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
  fireEvent.click(screen.getByRole('button', { name: /Next song/ }))
  expect(onNext).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Choose piano instead' })).toBeTruthy()
})

it('provides honest native piano controls without assigning the era song’s outcome', async () => {
  const onPlayed = vi.fn()
  const { unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  const player = await loadYouTube()
  fireEvent.click(screen.getByRole('button', { name: 'Choose piano instead' }))
  const audio = screen.getByLabelText('Für Elise, piano performed by V Gao')
  expect(screen.getByRole('heading', { name: 'Für Elise' })).toBeTruthy()
  expect(audio.controls).toBe(true)
  expect(audio.autoplay).toBe(false)
  expect(audio.preload).toBe('none')
  expect(audio.src).toMatch(/fur-elise-v-gao\.mp3/)
  expect(document.querySelector('iframe')).toBeNull()
  expect(player.destroy).toHaveBeenCalledOnce()
  fireEvent.playing(audio)
  expect(screen.getByRole('status').textContent).toBe('Playing here')
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Back to their song' }))
  await act(async () => {})
  expect(document.querySelector('audio')).toBeNull()
  expect(pauseAudio).toHaveBeenCalledOnce()
  expect(loadAudio).toHaveBeenCalledOnce()
  expect(audio.getAttribute('src')).toBeNull()
  unmount()
  expect(players.at(-1).destroy).toHaveBeenCalledOnce()
})

it('offers a local recording without any era song and reports native audio failures', () => {
  render(<MusicPlayer />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose piano instead' }))
  const audio = screen.getByLabelText('Für Elise, piano performed by V Gao')
  fireEvent.error(audio)
  expect(screen.getByRole('status').textContent).toMatch(/audio couldn’t load/)
  expect(screen.queryByRole('button', { name: 'Back to their song' })).toBeNull()
})

it('keeps native piano playable after StrictMode replays setup and cleanup', () => {
  render(<StrictMode><MusicPlayer /></StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Choose piano instead' }))
  const audio = screen.getByLabelText('Für Elise, piano performed by V Gao')
  expect(audio.getAttribute('src')).toMatch(/fur-elise-v-gao\.mp3/)
  expect(audio.crossOrigin).toBe('anonymous')
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
  expect(pauseAudio).toHaveBeenCalledOnce()
  expect(document.querySelectorAll('audio')).toHaveLength(1)
  expect(screen.getByLabelText('Your audio file: Another song.m4a').src).toBe('blob:http://localhost/local-audio-2')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/local-audio-2')
  expect(pauseAudio).toHaveBeenCalledTimes(2)
  expect(onPlayed).not.toHaveBeenCalled()
})

it('clears local audio on quiet mode and on changing to the included piano', () => {
  const { rerender } = render(<MusicPlayer />)
  const select = () => fireEvent.change(screen.getByLabelText('Choose an audio file from your device'), {
    target: { files: [new File(['audio'], 'Song.mp3', { type: 'audio/mpeg' })] },
  })
  select()
  fireEvent.click(screen.getByRole('button', { name: 'Choose piano instead' }))
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
  expect(screen.getByRole('button', { name: 'Choose piano instead' })).toBeTruthy()
})

it('handles a blocked API script and lets the caregiver retry later', async () => {
  delete window.YT
  const onPlayed = vi.fn()
  const { unmount } = render(<MusicPlayer song={firstSong} youtubeId={firstId} onPlayed={onPlayed} />)
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player/ }))
  const script = document.getElementById('moonrise-youtube-api')
  expect(script.src).toBe('https://www.youtube.com/iframe_api')
  await act(async () => fireEvent.error(script))
  expect(screen.getByRole('status').textContent).toMatch(/YouTube couldn’t connect/)
  expect(onPlayed).not.toHaveBeenCalled()
  unmount()
  render(<MusicPlayer song={firstSong} youtubeId={firstId} />)
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player/ }))
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
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player/ }))
  const ready = window.onYouTubeIframeAPIReady
  fireEvent.click(screen.getByRole('button', { name: 'Choose piano instead' }))
  window.YT = api
  await act(async () => ready())
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.querySelector('audio')).toBeTruthy()
  expect(players).toHaveLength(0)
  expect(onPlayed).not.toHaveBeenCalled()
  expect(previousReady).toHaveBeenCalledOnce()
  expect(window.onYouTubeIframeAPIReady).toBe(previousReady)
})
