// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Log from '../screens/Log.jsx'
import Report from '../screens/Report.jsx'

const profile = { name: 'Test person', birthYear: 1942, lat: 32.78, lon: -96.8 }
const sky = { ...profile, date: '2026-09-26', effectiveDusk: new Date(2026, 8, 26, 19, 15), cloudCover: 15 }
const base = { profile, logs: [], tonight: { date: sky.date, songIds: ['earth-angel-1954'] } }
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))
const openContext = () => { screen.getByText('Comfort steps used', { exact: false }).closest('details').open = true }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 27, 0, 30))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

function LogHarness({ initial = base, onUpdate, onDone }) {
  const [state, setState] = useState(initial)
  return <Log state={state} sky={sky} update={next => { setState(next); onUpdate(next) }} onDone={onDone} />
}

describe('deliberate, optional caregiver context entry', () => {
  it('keeps the one-tap path and does not infer comfort from a played song', () => {
    const onUpdate = vi.fn(), onDone = vi.fn()
    render(<LogHarness onUpdate={onUpdate} onDone={onDone} />)
    click('Calm')
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(onDone).toHaveBeenCalledOnce()
    expect(onUpdate.mock.calls[0][0].logs[0]).not.toHaveProperty('careContext')
  })

  it('does not save optional selections until an evening is explicitly saved', () => {
    const onUpdate = vi.fn(), onDone = vi.fn()
    render(<LogHarness onUpdate={onUpdate} onDone={onDone} />)
    openContext()
    fireEvent.click(screen.getByLabelText('Quiet company'))
    fireEvent.click(screen.getByLabelText('Lowered stimulation'))
    expect(onUpdate).not.toHaveBeenCalled()
    click('Restless')
    expect(onUpdate.mock.calls[0][0].logs[0].careContext).toEqual({ source: 'caregiver', comfortSteps: ['quiet-company', 'lowered-stimulation'] })
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('lets an optional edit be discarded without changing the saved record', () => {
    const onUpdate = vi.fn()
    const initial = { ...base, logs: [{ date: sky.date, outcome: 'calm', careContext: { source: 'caregiver', comfortSteps: ['conversation'] } }] }
    render(<LogHarness initial={initial} onUpdate={onUpdate} onDone={() => {}} />)
    openContext()
    fireEvent.click(screen.getByLabelText('Stopped session'))
    click('Discard optional changes')
    expect(screen.getByLabelText('Conversation').checked).toBe(true)
    expect(screen.getByLabelText('Stopped session').checked).toBe(false)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('saves an explicit none while preserving a saved onset; a later onset edit retains none', () => {
    const onUpdate = vi.fn(), onDone = vi.fn()
    const initial = { ...base, logs: [{ date: sky.date, outcome: 'episode', episodeStart: '2026-09-27T04:30:00.000Z', careContext: { source: 'caregiver', comfortSteps: ['conversation'] } }] }
    render(<LogHarness initial={initial} onUpdate={onUpdate} onDone={onDone} />)
    openContext()
    fireEvent.click(screen.getByLabelText('None of these'))
    expect(onUpdate).not.toHaveBeenCalled()
    click('Save comfort steps')
    expect(onUpdate.mock.calls[0][0].logs[0]).toMatchObject({ episodeStart: '2026-09-27T04:30:00.000Z', careContext: { source: 'caregiver', comfortSteps: [] } })
    expect(onDone).not.toHaveBeenCalled()
    click('Episode')
    fireEvent.change(screen.getByLabelText('Episode started at'), { target: { value: '00:15' } })
    click('Save time')
    expect(onUpdate.mock.lastCall[0].logs[0]).toMatchObject({ episodeStart: '2026-09-27T05:15:00.000Z', careContext: { source: 'caregiver', comfortSteps: [] } })
  })
})

describe('source-separated printable handoff', () => {
  const logs = [
    { date: '2026-09-24', outcome: 'episode', episodeStart: null, songIds: ['earth-angel-1954'], careContext: { source: 'caregiver', comfortSteps: [] } },
    { date: '2026-09-25', outcome: 'restless', songIds: [] },
    { date: '2026-09-26', outcome: 'calm', songIds: ['my-girl-1964'], demo: true, careContext: { source: 'caregiver', comfortSteps: ['familiar-music'] } },
  ]
  it('defaults mixed data to only recorded evenings and displays actual missingness', () => {
    render(<Report state={{ profile, logs }} />)
    const coverage = screen.getByRole('region', { name: 'Record completeness' })
    expect(coverage.textContent).toContain('2 of 7 evenings recorded')
    expect(coverage.textContent).toContain('5 not recorded')
    expect(coverage.textContent).toContain('Comfort steps: 1 entered, 1 not recorded')
    expect(coverage.textContent).toContain('Episode onset: 0 times entered among 1 episode label; 1 not recorded')
    expect(screen.getByText('Earth Angel')).toBeTruthy()
    expect(screen.queryByText('My Girl')).toBeNull()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(8)
    expect(table.textContent).toContain('None of the listed steps (reported)')
    expect(within(table).getAllByText('Caregiver record')).toHaveLength(2)
    expect(within(table).queryByText('Fictional example')).toBeNull()
    // Missingness survives printing; it is not hidden by the no-print class.
    for (const missing of within(table).getAllByText('Not recorded')) expect(missing.closest('.no-print')).toBeNull()
  })

  it('requires the separate preview to see fictional data and labels every example row', () => {
    render(<Report state={{ profile, logs }} />)
    click('Fictional example preview')
    expect(screen.getByRole('region', { name: 'Record completeness' }).textContent).toContain('1 of 7 evenings shown as examples')
    expect(screen.getByText('My Girl')).toBeTruthy()
    expect(screen.queryByText('Earth Angel')).toBeNull()
    expect(screen.getByText('All populated rows are fictional demo data. This is not a care record.')).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Fictional example')).toHaveLength(1)
    expect(within(table).queryByText('Caregiver record')).toBeNull()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    click('Print example')
    expect(print).toHaveBeenCalledOnce()
    click('Recorded evenings')
    expect(screen.getByRole('button', { name: 'Print care handoff' })).toBeTruthy()
  })

  it('keeps the useful example-only preview explicit without assigning examples to the person', () => {
    render(<Report state={{ profile, logs: [logs[2]] }} />)
    expect(screen.getByText('EXAMPLE — fictional evening handoff')).toBeTruthy()
    expect(document.querySelector('.report-print-heading').textContent).not.toContain(profile.name)
    click('Recorded evenings')
    expect(screen.getByText('No caregiver-recorded evenings yet.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
