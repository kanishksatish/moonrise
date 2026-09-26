// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Settings from '../screens/Settings.jsx'
import { clearAiKey, emptyState } from '../engine/index.js'
import { clearComfortPhotos } from '../engine/comfortPhoto.js'

vi.mock('../engine/index.js', async original => ({
  ...await original(), clearAiKey: vi.fn(() => true),
}))
vi.mock('../engine/comfortPhoto.js', () => ({ clearComfortPhotos: vi.fn() }))
// This regression concerns deletion ordering only; no provider or audio-storage
// checks should start when Settings mounts.
vi.mock('../components/AiPrompts.jsx', () => ({ default: () => null }))
vi.mock('../components/DeviceReadiness.jsx', () => ({ default: () => null }))

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

function deferred() {
  let resolve, reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

it('locks both delete choices while photos clear, preserves records on failure, then clears them after a successful retry', async () => {
  vi.stubGlobal('indexedDB', {})
  const initial = {
    profile: { name: 'Fictional Avery', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8 },
    logs: [{ date: '2026-09-25', outcome: 'calm' }],
    approvedPrompts: ['A fictional test conversation starter.'],
    eveningPlan: { photoId: 'fictional-photo' },
    sessions: [{ id: 'fictional-test-session', isDemo: true, events: [] }],
  }
  const update = vi.fn()
  function Harness() {
    const [state, setState] = useState(initial)
    return <>
      <output aria-label="Test record state">{JSON.stringify(state)}</output>
      {state.profile
        ? <Settings state={state} update={next => { update(next); setState(next); return true }} onEditProfile={vi.fn()} />
        : <p>All app records cleared.</p>}
    </>
  }
  const records = () => JSON.parse(screen.getByLabelText('Test record state').textContent)
  const first = deferred()
  clearComfortPhotos.mockReturnValueOnce(first.promise)
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete all data' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }))
  const pendingDelete = screen.getByRole('button', { name: 'Deleting…' })
  const keep = screen.getByRole('button', { name: 'Keep my data' })
  expect(pendingDelete.disabled).toBe(true)
  expect(keep.disabled).toBe(true)
  fireEvent.click(pendingDelete)
  fireEvent.click(keep)
  expect(clearComfortPhotos).toHaveBeenCalledOnce()
  expect(clearAiKey).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(records()).toEqual(initial)

  await act(async () => { first.reject(new Error('Fictional photo-store failure')); await first.promise.catch(() => {}) })
  expect(screen.getByRole('alert').textContent).toMatch(/Saved photos could not be removed/)
  expect(screen.getByRole('button', { name: 'Yes, delete everything' }).disabled).toBe(false)
  expect(screen.getByRole('button', { name: 'Keep my data' }).disabled).toBe(false)
  expect(clearAiKey).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(records()).toEqual(initial)

  const retry = deferred()
  clearComfortPhotos.mockReturnValueOnce(retry.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }))
  expect(screen.getByRole('button', { name: 'Deleting…' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Keep my data' }).disabled).toBe(true)
  expect(records()).toEqual(initial)
  await act(async () => { retry.resolve(); await retry.promise })
  expect(clearComfortPhotos).toHaveBeenCalledTimes(2)
  expect(clearAiKey).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledExactlyOnceWith(emptyState())
  expect(records()).toEqual(emptyState())
  expect(screen.getByText('All app records cleared.')).toBeTruthy()
})
