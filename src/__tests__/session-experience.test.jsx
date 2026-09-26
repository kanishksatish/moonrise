// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Moonrise from '../screens/Moonrise.jsx'

const approved = 'What flowers grew near your childhood home?'
const state = {
  profile: { name: 'Demo Rose', birthYear: 1942, lat: 32.78, lon: -96.8, anchors: { hometown: 'Dayton' } },
  logs: [], approvedPrompts: [approved],
}
let wakeDescriptor
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T23:00:00Z'))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  wakeDescriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')
})
afterEach(() => {
  cleanup()
  if (wakeDescriptor) Object.defineProperty(navigator, 'wakeLock', wakeDescriptor)
  else delete navigator.wakeLock
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks()
})
const wakeLock = request => Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })

it('releases a wake lock that resolves after the caregiver leaves the session', async () => {
  let resolve
  const release = vi.fn().mockResolvedValue(undefined)
  const request = vi.fn(() => new Promise(done => { resolve = done }))
  wakeLock(request)
  const { unmount } = render(<Moonrise state={state} onExit={vi.fn()} />)
  expect(request).toHaveBeenCalledExactlyOnceWith('screen')
  unmount()
  await act(async () => resolve({ release }))
  expect(release).toHaveBeenCalledOnce()
})

it('cleans up both wake requests when StrictMode replays setup, without releasing the active lock early', async () => {
  const pending = []
  wakeLock(vi.fn(() => new Promise(resolve => pending.push(resolve))))
  const early = { release: vi.fn().mockResolvedValue(undefined) }, active = { release: vi.fn().mockResolvedValue(undefined) }
  const { unmount } = render(<StrictMode><Moonrise state={state} onExit={vi.fn()} /></StrictMode>)
  expect(pending).toHaveLength(2)
  await act(async () => { pending[0](early); pending[1](active) })
  expect(early.release).toHaveBeenCalledOnce()
  expect(active.release).not.toHaveBeenCalled()
  unmount()
  expect(active.release).toHaveBeenCalledOnce()
})

it('keeps an approved conversation starter available without a technical badge, and quiet stops audio', () => {
  const onExit = vi.fn(), onPlayed = vi.fn()
  render(<Moonrise state={state} onExit={onExit} onPlayed={onPlayed} />)
  expect(screen.getByText(approved)).toBeTruthy()
  expect(screen.getByText('Conversation starter')).toBeTruthy()
  expect(screen.queryByText(/AI-written|reviewed by you/)).toBeNull()
  const quiet = screen.getByRole('button', { name: 'Quiet view' })
  expect(document.activeElement).toBe(quiet)
  expect(document.getElementById(quiet.getAttribute('aria-describedby')).textContent).toMatch(/Stops music/)
  const audio = document.querySelector('audio')
  fireEvent.playing(audio)
  fireEvent.click(quiet)
  expect(document.querySelector('audio')).toBeNull()
  expect(audio.getAttribute('src')).toBeNull()
  expect(screen.getByText('Music is stopped.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Next prompt' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Return to music' })).toBe(document.activeElement)
  fireEvent.click(screen.getByRole('button', { name: 'Return to music' }))
  expect(document.querySelector('audio').autoplay).toBe(false)
  expect(screen.getByText(approved)).toBeTruthy()
  expect(onPlayed).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
  expect(onExit).toHaveBeenCalledOnce()
})


it('keeps a storage failure visible in both the listening session and quiet view', () => {
  const { rerender } = render(<Moonrise state={state} onExit={vi.fn()} saveError />)
  const warning = 'This device could not save your changes. Keep this page open; changes may be lost when you close it.'
  expect(screen.getByRole('alert').textContent).toBe(warning)
  fireEvent.click(screen.getByRole('button', { name: 'Quiet view' }))
  expect(screen.getByRole('alert').textContent).toBe(warning)
  expect(screen.getByRole('button', { name: 'Return to music' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy()
  rerender(<Moonrise state={state} onExit={vi.fn()} saveError={false} />)
  expect(screen.queryByRole('alert')).toBeNull()
})
