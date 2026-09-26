// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LaunchSequence from '../components/LaunchSequence.jsx'
import { flightFrame, FLIGHT_MS } from '../components/launchFlight.js'

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
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

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


it('attaches the visible trail to the engine nozzle across narrow and wide flight geometry', () => {
  for (const [width, height] of [[284, 450], [1000, 570], [640, 320]]) {
    for (const elapsed of [0, 250, 800, 1364, 1900, FLIGHT_MS]) {
      const frame = flightFrame(elapsed, width, height)
      const pathNumbers = frame.trail.match(/-?[\d.]+(?:e[+-]?\d+)?/gi).map(Number)
      const transform = frame.transform.match(/-?[\d.]+(?:e[+-]?\d+)?/gi).map(Number)
      // Final path endpoint and transformed SVG nozzle (26,75) occupy the same pixel.
      expect(pathNumbers.slice(-2)).toEqual(frame.point)
      const [x, y, angle, scale, tx, ty] = transform
      const radians = angle * Math.PI / 180
      const nozzleX = x + scale * ((26 + tx) * Math.cos(radians) - (75 + ty) * Math.sin(radians))
      const nozzleY = y + scale * ((26 + tx) * Math.sin(radians) + (75 + ty) * Math.cos(radians))
      expect(nozzleX).toBeCloseTo(frame.point[0], 8)
      expect(nozzleY).toBeCloseTo(frame.point[1], 8)
      expect(Number.isFinite(angle) && scale > 0).toBe(true)
    }
    expect(flightFrame(FLIGHT_MS, width, height).point).toEqual([width * .74, height * .18])
  }
})

it('has continuous flight velocity through the former keyframe joins and settles at both ends', () => {
  const point = ms => flightFrame(ms, 1000, 570).point
  const delta = (a, b) => b.map((value, index) => value - a[index])
  for (const ms of [FLIGHT_MS * .24, FLIGHT_MS * .62]) {
    const before = delta(point(ms - 1), point(ms)), after = delta(point(ms), point(ms + 1))
    expect(Math.hypot(...delta(before, after))).toBeLessThan(.005)
  }
  expect(Math.hypot(...delta(point(0), point(1)))).toBeLessThan(.0001)
  expect(Math.hypot(...delta(point(FLIGHT_MS - 1), point(FLIGHT_MS)))).toBeLessThan(.0001)
})

it('updates one SVG flight without reading layout each frame and cancels the frame on exit', () => {
  let next, frameId = 0
  const request = vi.fn(callback => { next = callback; return ++frameId })
  const cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)
  const measure = vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 284, height: 450 })
  const done = vi.fn()
  const { container, unmount } = render(<LaunchSequence onComplete={done} />)
  const svg = container.querySelector('.launch-flight-path')
  expect(svg.getAttribute('viewBox')).toBe('0 0 284 450')
  const initialReads = measure.mock.calls.length
  const start = performance.now()
  for (const elapsed of [16, 200, 500, 1200]) act(() => next(start + elapsed))
  expect(measure).toHaveBeenCalledTimes(initialReads)
  const rocket = svg.querySelector('.launch-rocket'), trail = svg.querySelector('.launch-trail')
  expect(rocket.getAttribute('transform')).toBe(flightFrame(1200, 284, 450).transform)
  expect(trail.getAttribute('d')).toBe(flightFrame(1200, 284, 450).trail)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(cancel).toHaveBeenCalledWith(frameId)
  expect(done).toHaveBeenCalledOnce()
  const requests = request.mock.calls.length
  act(() => next(start + 1500))
  expect(request).toHaveBeenCalledTimes(requests)
  unmount()
})
