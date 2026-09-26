// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LaunchSequence from '../components/LaunchSequence.jsx'

let motion
let listeners
beforeEach(() => {
  vi.useFakeTimers()
  listeners = new Set()
  motion = {
    matches: false,
    addEventListener: vi.fn((event, callback) => listeners.add(callback)),
    removeEventListener: vi.fn((event, callback) => listeners.delete(callback)),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => motion))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('finishes once after 2.4 seconds and keeps the current callback without restarting', () => {
  const original = vi.fn()
  const latest = vi.fn()
  const { rerender } = render(<LaunchSequence onComplete={original} />)
  act(() => vi.advanceTimersByTime(1200))
  rerender(<LaunchSequence onComplete={latest} phase={0.25} />)
  act(() => vi.advanceTimersByTime(1199))
  expect(latest).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(original).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledOnce()
  act(() => vi.advanceTimersByTime(5000))
  expect(latest).toHaveBeenCalledOnce()
})

it('focuses the visible skip control and prevents skip and timer from completing twice', () => {
  const done = vi.fn()
  render(<LaunchSequence onComplete={done} />)
  const skip = screen.getByRole('button', { name: 'Skip launch' })
  expect(document.activeElement).toBe(skip)
  fireEvent.click(skip)
  fireEvent.click(skip)
  act(() => vi.advanceTimersByTime(3000))
  expect(done).toHaveBeenCalledOnce()
})

it('skips immediately for reduced motion without a pending timer', () => {
  motion.matches = true
  const done = vi.fn()
  render(<LaunchSequence onComplete={done} />)
  expect(done).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('honors a reduced-motion change during flight and removes its listener on unmount', () => {
  const done = vi.fn()
  const { unmount } = render(<LaunchSequence onComplete={done} />)
  act(() => { for (const listener of listeners) listener({ matches: true }) })
  expect(done).toHaveBeenCalledOnce()
  act(() => vi.advanceTimersByTime(3000))
  expect(done).toHaveBeenCalledOnce()
  unmount()
  expect(listeners.size).toBe(0)
})

it('clears the timer when interrupted, and Escape can dismiss a subsequent launch', () => {
  const interrupted = vi.fn()
  const { unmount } = render(<LaunchSequence onComplete={interrupted} />)
  unmount()
  act(() => vi.advanceTimersByTime(3000))
  expect(interrupted).not.toHaveBeenCalled()
  const done = vi.fn()
  render(<LaunchSequence onComplete={done} />)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(done).toHaveBeenCalledOnce()
})
