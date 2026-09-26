// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Today from '../screens/Today.jsx'
import Moonrise from '../screens/Moonrise.jsx'
import Setup from '../screens/Setup.jsx'
import { memoryPrompts, moonriseStart } from '../engine/index.js'

// AGENTS.md screens 2 and 3: Today shows moon phase and a countdown; Moonrise mode paints the real
// sky, raises a moon over the session and rotates one prompt every few minutes.
const profile = { name: 'Rose', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: { hometown: 'Dayton' } }
const sky = { date: '2026-09-26', sunset: new Date(2026, 8, 26, 19, 30), effectiveDusk: new Date(2026, 8, 26, 19, 15), cloudCover: 50, shiftMinutes: 15, source: 'forecast' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 26, 17, 0))
  localStorage.clear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('Today shows the moon phase, the start time and a countdown to it', () => {
  render(<Today state={{ profile, logs: [] }} sky={sky} onStart={() => {}} onSavePlan={() => {}}/>)
  const card = screen.getByRole('region', { name: 'Tonight’s sky' })
  // Default: 45 min before the 7:15 PM estimated dusk = 6:30 PM, 1 h 30 min from 5:00 PM.
  expect(card.textContent).toContain('6:30 PM · in 1 h 30 min')
  expect(card.textContent).toContain('7:15 PM')
  expect(card.querySelector('svg[role="img"]').getAttribute('aria-label')).toMatch(/moon|crescent|gibbous|quarter/i)
  expect(card.querySelector('.sky-card__demo')).toBeNull()
})

it('Today shows, clearly labelled, how a demo week would shift the start without changing the real one', () => {
  const logs = ['2026-09-21', '2026-09-22', '2026-09-23'].map((date, i) => ({
    date, outcome: 'episode', demo: true,
    effectiveDusk: new Date(2026, 8, 21 + i, 19, 20).toISOString(),
    episodeStart: new Date(2026, 8, 21 + i, 18, 40).toISOString(),
  }))
  const expected = moonriseStart(sky.effectiveDusk, logs)
  render(<Today state={{ profile, logs }} sky={sky} onStart={() => {}} onSavePlan={() => {}}/>)
  const demo = document.querySelector('.sky-card__demo')
  expect(demo.textContent).toContain('Demo week')
  expect(demo.textContent).toContain(`${expected.minutesBeforeDusk} min before dusk`)
  expect(expected.minutesBeforeDusk).not.toBe(45)
  // The real suggestion still ignores demo evenings.
  expect(screen.getByRole('region', { name: 'Tonight’s sky' }).textContent).toContain('6:30 PM')
})

it('Moonrise mode paints the live sky, raises the moon and rotates prompts every few minutes', () => {
  render(<Moonrise state={{ profile, logs: [] }} onPlayed={() => {}} onExit={() => {}}/>)
  fireEvent.click(screen.getByRole('button', { name: 'A familiar story' }))
  const stage = document.querySelector('.sky-stage')
  expect(stage.getAttribute('style')).toMatch(/linear-gradient/)
  expect(Number(stage.dataset.rise)).toBe(0)
  const prompts = memoryPrompts(profile, { approved: [] })
  const first = document.querySelector('.prompt-text').textContent
  expect(first).toBe(prompts[0])
  act(() => { vi.advanceTimersByTime(30 * 60000) })
  expect(Number(document.querySelector('.sky-stage').dataset.rise)).toBeCloseTo(0.5, 1)
  expect(document.querySelector('.prompt-text').textContent).toBe(prompts[10 % prompts.length])
  act(() => { vi.advanceTimersByTime(40 * 60000) })
  expect(Number(document.querySelector('.sky-stage').dataset.rise)).toBe(1)
})

it('Setup shows songs from the person’s youth once a birth year is entered', () => {
  render(<Setup onDone={() => {}}/>)
  fireEvent.change(screen.getByLabelText('Year they were born'), { target: { value: '1942' } })
  expect(screen.getByText('Songs from their youth, 1952–1972')).toBeTruthy()
})
