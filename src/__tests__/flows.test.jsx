// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import Setup from '../screens/Setup.jsx'
import { effectiveDusk, findCity } from '../engine/index.js'

vi.mock('../engine/index.js', async (original) => ({
  ...await original(), effectiveDusk: vi.fn(), findCity: vi.fn(),
}))

const profile = { name: 'Test', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: {} }
const initial = { profile, logs: [], tonight: { date: '2026-09-26', songIds: ['earth-angel-1954'] } }
const saved = () => JSON.parse(localStorage.getItem('moonrise:v1'))
const click = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 27, 0, 30))
  localStorage.clear()
  vi.clearAllMocks()
  effectiveDusk.mockImplementation(async (date) => {
    const sunset = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19, 15)
    return { sunset, effectiveDusk: sunset, cloudCover: null, shiftMinutes: 0, source: 'offline' }
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('App midnight integration', () => {
  it('saves a 23:30 episode after midnight with the previous evening’s sky and songs', async () => {
    localStorage.setItem('moonrise:v1', JSON.stringify(initial))
    await act(async () => render(<App />))
    expect(effectiveDusk.mock.calls[0][0].getDate()).toBe(26)
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
