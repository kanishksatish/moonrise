// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import Setup from '../screens/Setup.jsx'
import Moonrise from '../screens/Moonrise.jsx'
import Report from '../screens/Report.jsx'
import includedCatalog from '../assets/audio/catalog.json'
import { effectiveDusk, findCity, songVideo } from '../engine/index.js'

vi.mock('../engine/index.js', async (original) => ({
  ...await original(), effectiveDusk: vi.fn(), findCity: vi.fn(), songVideo: vi.fn(),
}))

const profile = { name: 'Test', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: {} }
const initial = { profile, logs: [], tonight: { date: '2026-09-26', songIds: ['earth-angel-1954'] } }
const saved = () => JSON.parse(localStorage.getItem('moonrise:v1'))
const click = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const failStateWrites = () => {
  const originalSetItem = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === 'moonrise:v1') throw new DOMException('Storage full', 'QuotaExceededError')
    return originalSetItem.call(this, key, value)
  })
}
const chooseYouTube = () => {
  screen.getByText('Optional YouTube song').closest('details').open = true
  fireEvent.click(screen.getByRole('button', { name: /Load YouTube player/ }))
}
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

it('moves focus into a new screen and optional onset step without stealing it during refresh', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  const navigation = screen.getByRole('button', { name: 'Log', exact: true })
  navigation.focus()
  fireEvent.click(navigation)
  expect(document.activeElement).toBe(screen.getByRole('main', { name: 'Evening log' }))
  const episode = screen.getByRole('button', { name: 'Episode', exact: true })
  episode.focus()
  fireEvent.click(episode)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'When did it start?' }))
  const time = screen.getByLabelText('Episode started at')
  time.focus()
  await act(async () => vi.advanceTimersByTime(15000))
  expect(document.activeElement).toBe(time)
  click('Skip')
  expect(document.activeElement).toBe(screen.getByRole('main', { name: 'Today' }))
})

it('focuses Today when first setup completes even though the initial screen was already today', async () => {
  findCity.mockResolvedValue({ city: 'Dallas', lat: 32.78, lon: -96.8 })
  await act(async () => render(<App />))
  expect(document.activeElement).toBe(screen.getByRole('form', { name: 'Caregiver setup' }))
  fireEvent.change(screen.getByLabelText('Their first name'), { target: { value: 'Fictional Avery' } })
  fireEvent.change(screen.getByLabelText('Year they were born'), { target: { value: '1942' } })
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Dallas' } })
  await act(async () => click('Find'))
  await act(async () => click('Start'))
  expect(document.activeElement).toBe(screen.getByRole('main', { name: 'Today' }))
})

it('retains first-setup details and the form after a failed write, then completes an explicit retry', async () => {
  findCity.mockResolvedValue({ city: 'Dallas', lat: 32.78, lon: -96.8 })
  await act(async () => render(<App />))
  fireEvent.change(screen.getByLabelText('Their first name'), { target: { value: 'Fictional Avery' } })
  fireEvent.change(screen.getByLabelText('Year they were born'), { target: { value: '1942' } })
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Dallas' } })
  await act(async () => click('Find'))
  const hometown = screen.getByLabelText('Hometown')
  hometown.closest('details').open = true
  fireEvent.change(hometown, { target: { value: 'Dayton' } })
  const storageWrite = failStateWrites()
  await act(async () => click('Start'))

  expect(saved()).toBeNull()
  expect(screen.getByRole('form', { name: 'Caregiver setup' })).toBeTruthy()
  expect(screen.queryByRole('main', { name: 'Today' })).toBeNull()
  expect(screen.getByLabelText('Their first name').value).toBe('Fictional Avery')
  expect(screen.getByLabelText('Year they were born').value).toBe('1942')
  expect(screen.getByLabelText('Hometown').value).toBe('Dayton')
  expect(screen.getByText('Dallas')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('not saved to this device')
  expect(screen.getByRole('alert').closest('.onboarding-actions')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Save', exact: true }).disabled).toBe(false)
  expect(screen.getByRole('button', { name: 'Leave for now (not saved)' })).toBeTruthy()

  storageWrite.mockRestore()
  await act(async () => click('Save'))
  expect(screen.queryByRole('form', { name: 'Caregiver setup' })).toBeNull()
  expect(screen.getByRole('main', { name: 'Today' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(saved().profile).toMatchObject({ name: 'Fictional Avery', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: { hometown: 'Dayton' } })
})

it('keeps an edited profile retryable without changing the stored profile or losing other records', async () => {
  const original = { ...initial, logs: [{ date: '2026-09-25', outcome: 'calm' }], approvedPrompts: ['Tell me about a favorite garden.'] }
  localStorage.setItem('moonrise:v1', JSON.stringify(original))
  await act(async () => render(<App />))
  click('Settings'); click('Edit details')
  fireEvent.change(screen.getByLabelText('Their first name'), { target: { value: 'Fictional Rowan' } })
  const storageWrite = failStateWrites()
  await act(async () => click('Save'))
  expect(saved()).toEqual(original)
  expect(screen.getByRole('form', { name: 'Caregiver setup' })).toBeTruthy()
  expect(screen.getByLabelText('Their first name').value).toBe('Fictional Rowan')
  expect(screen.getByRole('alert').textContent).toContain('not saved to this device')
  expect(screen.getByRole('button', { name: 'Save', exact: true }).disabled).toBe(false)
  expect(screen.queryByRole('button', { name: 'Cancel', exact: true })).toBeNull()

  storageWrite.mockRestore()
  await act(async () => click('Save'))
  expect(screen.getByRole('main', { name: 'Today' })).toBeTruthy()
  expect(saved().profile.name).toBe('Fictional Rowan')
  expect(saved().logs).toMatchObject(original.logs)
  expect(saved().approvedPrompts).toEqual(original.approvedPrompts)
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps an earlier outstanding save visible in profile editing and preserves it when leaving for now', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  const storageWrite = failStateWrites()
  click('Log'); click('Calm')
  click('Settings'); click('Edit details')
  expect(screen.getByRole('form', { name: 'Caregiver setup' })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('not saved to this device')
  expect(saved().logs).toEqual([])
  click('Leave for now (not saved)')
  expect(screen.getByRole('main', { name: 'Caregiver settings' })).toBeTruthy()
  storageWrite.mockRestore()
  click('Retry saving changes')
  expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', outcome: 'calm' })
  expect(saved().profile.name).toBe(profile.name)
})

it('accepts a legacy standalone Setup completion callback that returns undefined', () => {
  const completeProfile = { ...profile, anchors: { hometown: '', spouse: '', job: '' } }
  const onDone = vi.fn()
  render(<Setup profile={completeProfile} onDone={onDone} onCancel={vi.fn()} />)
  click('Save')
  expect(onDone).toHaveBeenCalledExactlyOnceWith(completeProfile)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('button', { name: 'Cancel', exact: true })).toBeTruthy()
})

it('delivers routine reminders from Settings without repeating them when screens change', async () => {
  const delivered = vi.fn()
  vi.stubGlobal('Notification', class {
    static permission = 'granted'
    static requestPermission = vi.fn().mockResolvedValue('granted')
    constructor(...args) { delivered(...args) }
  })
  vi.setSystemTime(new Date(2026, 8, 26, 18, 15))
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  click('Settings')
  vi.setSystemTime(new Date(2026, 8, 26, 18, 21))
  await act(async () => vi.advanceTimersByTime(15000))
  expect(delivered).toHaveBeenCalledOnce()
  expect(delivered.mock.calls[0][1].body).toMatch(/starts in/)
  expect(screen.getByRole('button', { name: 'View routine' })).toBeTruthy()
  click('Report'); click('Today'); click('Settings')
  expect(delivered).toHaveBeenCalledOnce()
  vi.setSystemTime(new Date(2026, 8, 26, 18, 31))
  await act(async () => vi.advanceTimersByTime(15000))
  expect(delivered).toHaveBeenCalledTimes(2)
  expect(delivered.mock.calls[1][1].body).toMatch(/Start Moonrise now/)
  click('Today')
  expect(delivered).toHaveBeenCalledTimes(2)
})

it('keeps a routine reminder visible on other screens when browser notifications are off', async () => {
  const delivered = vi.fn()
  vi.stubGlobal('Notification', class {
    static permission = 'denied'
    static requestPermission = vi.fn().mockResolvedValue('denied')
    constructor(...args) { delivered(...args) }
  })
  vi.setSystemTime(new Date(2026, 8, 26, 18, 31))
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  click('Report')
  expect(screen.getByRole('status').textContent).toMatch(/Start Moonrise now/)
  click('View routine')
  expect(screen.getByRole('button', { name: 'Start Moonrise now' })).toBeTruthy()
  expect(delivered).not.toHaveBeenCalled()
})

it('does not remind during or after an already-started routine, then allows the next evening', async () => {
  const delivered = vi.fn()
  vi.stubGlobal('Notification', class {
    static permission = 'granted'
    static requestPermission = vi.fn().mockResolvedValue('granted')
    constructor(...args) { delivered(...args) }
  })
  vi.setSystemTime(new Date(2026, 8, 26, 18, 10))
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  click('Start Moonrise now'); click('Skip launch')
  vi.setSystemTime(new Date(2026, 8, 26, 18, 21))
  await act(async () => vi.advanceTimersByTime(15000))
  expect(delivered).not.toHaveBeenCalled()
  click('Finish'); click('Today')
  expect(delivered).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(saved().logs).toEqual([])
  vi.setSystemTime(new Date(2026, 8, 27, 18, 21))
  await act(async () => vi.advanceTimersByTime(15000))
  expect(delivered).toHaveBeenCalledOnce()
})

it('keeps a failed note visibly unsaved after navigation and retries the complete state', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  const originalSetItem = Storage.prototype.setItem
  const storageWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === 'moonrise:v1') throw new DOMException('Storage full', 'QuotaExceededError')
    return originalSetItem.call(this, key, value)
  })
  click('Log'); click('Calm')
  expect(screen.getByRole('heading', { name: 'How was tonight?' })).toBeTruthy()
  expect(saved().logs).toEqual([])
  click('Today')
  expect(screen.queryByText(/Tonight’s note is saved/)).toBeNull()
  expect(screen.getByText(/Changes are waiting to be saved/)).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toMatch(/could not save/)
  storageWrite.mockRestore()
  click('Retry saving changes')
  expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', outcome: 'calm' })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText(/Tonight’s note is saved/)).toBeTruthy()
})

describe('App midnight integration', () => {
  it('saves a 23:30 episode after midnight with the previous evening’s sky and songs', async () => {
    localStorage.setItem('moonrise:v1', JSON.stringify(initial))
    await act(async () => render(<App />))
    expect(effectiveDusk.mock.calls[0][0].getDate()).toBe(26)
    expect(document.querySelector('.today-date').textContent).toContain('September 26')
    expect(document.querySelector('.today-date').textContent).toContain('Saturday')
    click('Log'); click('Episode')
    fireEvent.change(screen.getByLabelText('Episode started at'), { target: { value: '23:30' } })
    click('Save time')
    expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', episodeStart: '2026-09-27T04:30:00.000Z',
      effectiveDusk: '2026-09-27T00:15:00.000Z', songIds: ['earth-angel-1954'] })
    expect(screen.getByText(/Tonight’s note is saved/)).toBeTruthy()
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
  const unplayedEvening = { ...initial, tonight: { ...initial.tonight, songIds: [] } }
  render(<Moonrise state={unplayedEvening} onPlayed={onPlayed} onExit={() => {}} />)
  expect(onPlayed).not.toHaveBeenCalled()
  fireEvent.playing(document.querySelector('audio'))
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(includedCatalog[0].id)
  await act(async () => chooseYouTube())
  expect(onPlayed).toHaveBeenCalledOnce()
  act(() => players[0].events.onStateChange({ data: 1 }))
  expect(onPlayed).toHaveBeenCalledTimes(2)
  expect(onPlayed.mock.calls[1][0]).not.toMatch(/^bundled-/)
  click('Quiet view')
  expect(players[0].destroy).toHaveBeenCalledOnce()
  expect(document.querySelector('iframe')).toBeNull()
})

it('offers included audio and generic conversation instead of unavailable era-song titles', () => {
  const onPlayed = vi.fn()
  render(<Moonrise state={initial} onPlayed={onPlayed} onExit={() => {}} />)
  expect(screen.queryByRole('link', { name: /Spotify|YouTube/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Load YouTube/ })).toBeNull()
  expect(screen.getByRole('combobox', { name: 'Choose an included recording' })).toBeTruthy()
  expect(document.querySelector('.prompt-text').textContent).not.toContain('Do you remember "')
  const audio = screen.getByLabelText(/Für Elise —/)
  fireEvent.playing(audio)
  expect(onPlayed).toHaveBeenCalledExactlyOnceWith(includedCatalog[0].id)
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
  await act(async () => chooseYouTube())
  act(() => players[0].events.onStateChange({ data: 1 }))
  click('Finish'); click('Calm')
  expect(players[0].destroy).toHaveBeenCalledOnce()
  expect(saved().logs).toHaveLength(1)
  expect(saved().logs[0]).toMatchObject({ date: '2026-09-26', outcome: 'calm' })
  expect(saved().logs[0].songIds).toHaveLength(1)
})

it('preserves actual bundled IDs alongside old era IDs through playback, storage, and the report', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify(initial))
  await act(async () => render(<App />))
  click('Start Moonrise now'); click('Skip launch')
  fireEvent.playing(document.querySelector('audio'))
  fireEvent.pause(document.querySelector('audio'))
  fireEvent.playing(document.querySelector('audio'))
  click('Finish'); click('Calm')
  expect(saved().logs[0].songIds).toEqual(['earth-angel-1954', includedCatalog[0].id])
  cleanup()
  await act(async () => render(<App />))
  click('Report')
  expect(screen.getByText('Earth Angel')).toBeTruthy()
  expect(screen.getByText(includedCatalog[0].title)).toBeTruthy()
  expect(screen.getByText(/Included recording/)).toBeTruthy()
  expect(screen.getByText(/does not show that a song caused a change/)).toBeTruthy()
})

it('shows bundled tracks with an unknown recording year without inventing a year', () => {
  const recording = includedCatalog.find(item => item.recordingYear === null)
  expect(recording).toBeTruthy()
  render(<Report state={{ ...initial, logs: [{ date: '2026-09-26', outcome: 'calm', songIds: [recording.id] }] }} />)
  const row = screen.getByText(recording.title).closest('li')
  expect(row.textContent).toContain('Included recording')
  expect(row.textContent).not.toMatch(/null|undefined|\(0\)/)
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
  expect(screen.getByText('An approved memory question.')).toBeTruthy()
  click('Next prompt')
  const prompt = document.querySelector('.prompt-text').textContent
  expect(prompt).not.toBe('An approved memory question.')
  const song = document.querySelector('.music-player-title').textContent
  click('Quiet view')
  expect(screen.queryByText(prompt)).toBeNull()
  expect(screen.queryByRole('combobox', { name: 'Choose an included recording' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Show conversation' }).getAttribute('aria-pressed')).toBe('true')
  click('Show conversation')
  expect(screen.getByText(prompt)).toBeTruthy()
  expect(document.querySelector('.music-player-title').textContent).toBe(song)
  click('Finish')
  expect(onExit).toHaveBeenCalledOnce()
})

it('offers the same real listening library for a birth year outside the era catalog', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify({ ...initial, profile: { ...profile, birthYear: 1900 } }))
  await act(async () => render(<App />))
  expect(screen.getByText(`${includedCatalog.length} included recordings to play here, or choose a music file from your device.`)).toBeTruthy()
  expect(screen.queryByText(/Music from 1910/)).toBeNull()
})
