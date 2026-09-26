// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import Setup from '../screens/Setup.jsx'
import Moonrise from '../screens/Moonrise.jsx'
import { effectiveDusk, findCity, songVideo } from '../engine/index.js'

vi.mock('../engine/index.js', async (original) => ({
  ...await original(), effectiveDusk: vi.fn(), findCity: vi.fn(), songVideo: vi.fn(),
}))

const profile = { name: 'Test', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: {} }
const initial = { profile, logs: [], tonight: { date: '2026-09-26', songIds: ['earth-angel-1954'] } }
const saved = () => JSON.parse(localStorage.getItem('moonrise:v1'))
const click = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))
let players

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 27, 0, 30))
  localStorage.clear()
  vi.clearAllMocks()
  songVideo.mockReturnValue(null)
  players = []
  vi.stubGlobal('YT', { Player: class {
    constructor(frame, options) {
      this.events = options.events
      this.pauseVideo = vi.fn()
      this.destroy = vi.fn()
      players.push(this)
    }
  } })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  effectiveDusk.mockImplementation(async (date) => {
    const sunset = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 15)
    return { sunset, effectiveDusk: sunset, cloudCover: null, shiftMinutes: 0, source: 'offline' }
  })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('App midnight integration', () => {
  it('saves a 23:30 episode after midnight with the previous evening’s sky and songs', async () => {
    localStorage.setItem('moonrise:v1', JSON.stringify(initial))
    await act(async () => render(<App />))
    expect(effectiveDusk.mock.calls[0][0].getDate()).toBe(26)
    expect(screen.getByText('Saturday, September 26')).toBeTruthy()
    click('Log'); click('Episode')
    fireEvent.change(screen.getByLabelText('Episode started at'), { target: { value: '23:30' } })
    click('Save time')
    expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', episodeStart: '2026-09-27T04:30:00.000Z',
      effectiveDusk: '2026-09-27T00:15:00.000Z', songIds: ['earth-angel-1954'] })
    expect(screen.getByText(/Tonight is logged:/)).toBeTruthy()
  })
  it('blocks a future onset without recording the invalid time', async () => {
    localStorage.setItem('moonrise:v1', JSON.stringify(initial))
    await act(async () => render(<App />))
    click('Log'); click('Episode')
    fireEvent.change(screen.getByLabelText('Episode started at'), { target: { value: '00:45' } })
    click('Save time')
    expect(screen.getByRole('alert').textContent).toMatch(/future/)
    expect(saved().logs[0].episodeStart).toBeNull()
  })
  it('blocks a stale save at 04:00, then refreshes the sky for the new evening', async () => {
    localStorage.setItem('moonrise:v1', JSON.stringify(initial))
    await act(async () => render(<App />))
    click('Log')
    vi.setSystemTime(new Date(2026, 8, 27, 4))
    click('Calm')
    expect(screen.getByRole('alert').textContent).toMatch(/refresh/)
    expect(saved().logs).toEqual([])
    await act(async () => vi.advanceTimersByTime(15000))
    click('Calm')
    expect(saved().logs[0]).toMatchObject({ date: '2026-09-27', songIds: [] })
    expect(new Date(saved().logs[0].effectiveDusk).getDate()).toBe(27)
  })
})

describe('Setup city lookup', () => {
  async function search(result, rejects = false) {
    if (rejects) findCity.mockRejectedValue(new Error('offline'))
    else findCity.mockResolvedValue(result)
    render(<Setup onDone={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'City' }), { target: { value: 'Dallas' } })
    await act(async () => click('Find'))
  }
  it('displays a resolved city', async () => {
    await search({ lat: 32.78, lon: -96.8, city: 'Dallas, Texas, United States' })
    expect(screen.getByText('Dallas, Texas, United States')).toBeTruthy()
  })
  it('distinguishes a missing city from a connection failure', async () => {
    await search(null)
    expect(screen.getByRole('status').textContent).toMatch(/Could not find that city/)
    cleanup()
    await search(null, true)
    expect(screen.getByRole('status').textContent).toMatch(/Could not check cities right now/)
  })
})

it('records a song only after the integrated player observes playback', async () => {
  songVideo.mockReturnValue({ youtubeId: 'TJx9E-rUqhg' })
  const onPlayed = vi.fn()
  render(<Moonrise state={initial} onPlayed={onPlayed} onExit={() => {}} />)
  expect(onPlayed).not.toHaveBeenCalled()
  click('Next song')
  expect(onPlayed).not.toHaveBeenCalled()
  await act(async () => click('Load YouTube player'))
  expect(onPlayed).not.toHaveBeenCalled()
  act(() => players[0].events.onStateChange({ data: 1 }))
  expect(onPlayed).toHaveBeenCalledOnce()
  expect(typeof onPlayed.mock.calls[0][0]).toBe('string')
  click('Quiet view')
  expect(players[0].destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
})

it('keeps unverified candidates unavailable and offers in-app piano without logging an era song', () => {
  const onPlayed = vi.fn()
  render(<Moonrise state={initial} onPlayed={onPlayed} onExit={() => {}} />)
  expect(screen.queryByRole('link', { name: /Spotify|YouTube/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Load YouTube/ })).toBeNull()
  click('Choose piano instead')
  const audio = screen.getByLabelText('Für Elise, piano performed by V Gao')
  fireEvent.playing(audio)
  expect(onPlayed).not.toHaveBeenCalled()
  click('Quiet view')
  expect(document.querySelector('audio')).toBeNull()
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce()
})

it('counts all logged outcomes equally in the constellation and labels demo stars', async () => {
  const logs = [
    { date: '2026-09-24', outcome: 'calm' },
    { date: '2026-09-25', outcome: 'restless', demo: true },
    { date: '2026-09-26', outcome: 'episode' },
    { date: '2026-09-19', outcome: 'calm' }, // outside the seven-evening window
  ]
  localStorage.setItem('moonrise:v1', JSON.stringify({ ...initial, logs }))
  await act(async () => render(<App />))
  const constellation = screen.getByRole('region', { name: 'Your seven evening constellation' })
  expect(constellation.textContent).toContain('3 of 7 logged')
  expect(constellation.textContent).toContain('Includes demo evenings.')
  expect(constellation.textContent).toContain('Every kind of evening counts.')
  expect(constellation.querySelectorAll('.star-filled')).toHaveLength(3)
})

it('recovers a damaged stored session through a complete song-and-log flow', async () => {
  songVideo.mockReturnValue({ youtubeId: 'TJx9E-rUqhg' })
  localStorage.setItem('moonrise:v1', JSON.stringify({
    ...initial, logs: [{ date: '2026-99-99', outcome: 'calm' }],
    tonight: { date: '2026-09-26', songIds: null },
  }))
  await act(async () => render(<App />))
  click('Start Moonrise now'); click('Skip launch')
  await act(async () => click('Load YouTube player'))
  act(() => players[0].events.onStateChange({ data: 1 }))
  click('Finish'); click('Calm')
  expect(players[0].destroy).toHaveBeenCalledOnce()
  expect(saved().logs).toHaveLength(1)
  expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', outcome: 'calm' })
  expect(saved().logs[0].songIds).toHaveLength(1)
})


it('launches only on request and automatically enters a usable routine', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  expect(screen.queryByRole('dialog')).toBeNull()
  document.documentElement.scrollTop = 500
  click('Start Moonrise now')
  expect(document.documentElement.scrollTop).toBe(0)
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Next prompt' })).toBeNull()
  await act(async () => vi.advanceTimersByTime(2400))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Quiet view' })).toBe(document.activeElement)
  click('Finish')
  expect(screen.getByRole('button', { name: 'Calm' })).toBeTruthy()
})

it('lets the caregiver change the prompt and hide conversation without losing the session', () => {
  const onExit = vi.fn()
  render(<Moonrise state={{ ...initial, approvedPrompts: ['An approved memory question.'] }} onPlayed={() => {}} onExit={onExit} />)
  click('Next prompt')
  expect(screen.getByText('An approved memory question.')).toBeTruthy()
  const song = document.querySelector('.music-player-title').textContent
  click('Quiet view')
  expect(screen.queryByText('An approved memory question.')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Choose piano instead' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Show conversation' }).getAttribute('aria-pressed')).toBe('true')
  click('Show conversation')
  expect(screen.getByText('An approved memory question.')).toBeTruthy()
  expect(document.querySelector('.music-player-title').textContent).toBe(song)
  click('Finish')
  expect(onExit).toHaveBeenCalledOnce()
})

it('does not promise era music when the collection has no matching songs', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify({ ...initial, profile: { ...profile, birthYear: 1900 } }))
  await act(async () => render(<App />))
  expect(screen.getByText(/Their era is not in our song collection yet/)).toBeTruthy()
})
