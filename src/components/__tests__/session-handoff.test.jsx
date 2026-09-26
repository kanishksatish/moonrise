// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SessionHandoff from '../SessionHandoff.jsx'
import { sessionRevision } from '../../engine/eveningSession.js'

afterEach(cleanup)

const event = (id, text, overrides = {}) => ({
  id, type: 'observation', activity: null, source: 'caregiver', at: '2026-09-26T22:04:00.000Z', text, ...overrides,
})
const session = overrides => ({
  id: 'session-real', date: '2026-09-26', startedAt: '2026-09-26T22:00:00.000Z',
  displayName: 'Fictional Avery', isDemo: false, events: [],
  plan: { caregiverCue: 'Sit beside me and speak slowly.', avoid: 'Questions that test memory.' },
  ...overrides,
})

describe('session handoff evidence and review', () => {
  it('renders an empty handoff for existing users with no session history', () => {
    const { rerender } = render(<SessionHandoff />)
    expect(screen.getByText('No session handoff is available yet.')).toBeTruthy()
    rerender(<SessionHandoff sessions={null} />)
    expect(screen.getByText('No session handoff is available yet.')).toBeTruthy()
  })

  it('keeps recorded and fictional sessions separate even when the example is newer', () => {
    const recorded = session({ events: [event('real-note', 'Recorded-only note')] })
    const example = session({ id: 'session-demo', isDemo: true, startedAt: '2026-09-26T23:00:00.000Z', events: [event('example-note', 'Fictional-only note')] })
    render(<SessionHandoff sessions={[example, recorded]} onReview={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Recorded sessions' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText(/Caregiver observation: “Recorded-only note”/)).toBeTruthy()
    expect(screen.queryByText(/Caregiver observation: “Fictional-only note”/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Fictional examples' }))
    expect(screen.getByText('FICTIONAL EXAMPLE · Not a care record')).toBeTruthy()
    expect(screen.getByText(/Example only.*Caregiver observation: “Fictional-only note”/)).toBeTruthy()
    expect(screen.queryByText(/Caregiver observation: “Recorded-only note”/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Review this example' })).toBeTruthy()
  })

  it('requests review of the exact revision without optimistically marking it reviewed', () => {
    const current = session({ events: [event('note-1', 'Asked to sit quietly.')] })
    const onReview = vi.fn()
    const { rerender } = render(<SessionHandoff sessions={[current]} onReview={onReview} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as reviewed' }))
    expect(onReview).toHaveBeenCalledExactlyOnceWith(current.id, sessionRevision(current))
    expect(screen.getByText('Caregiver review pending')).toBeTruthy()
    expect(screen.queryByText('Reviewed by caregiver')).toBeNull()
    rerender(<SessionHandoff sessions={[{ ...current, reviewedRevision: sessionRevision(current) }]} onReview={onReview} />)
    expect(screen.getByText('Reviewed by caregiver')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('status'))
  })

  it('invalidates an earlier review for appended actions, same-length edits and plan changes', () => {
    const original = session({ events: [event('note-1', 'Asked to sit quietly.')] })
    const reviewed = { ...original, reviewedRevision: sessionRevision(original) }
    const { rerender } = render(<SessionHandoff sessions={[reviewed]} onReview={vi.fn()} />)
    expect(screen.getByText('Reviewed by caregiver')).toBeTruthy()
    for (const changed of [
      { ...reviewed, events: [...reviewed.events, event('note-2', 'Finished at their request.')] },
      { ...reviewed, events: [event('note-1', 'Asked for a different song.')] },
      { ...reviewed, plan: { ...reviewed.plan, caregiverCue: 'Give me time to answer.' } },
      { ...reviewed, startedAt: '2026-09-26T21:59:00.000Z' },
    ]) {
      rerender(<SessionHandoff sessions={[changed]} onReview={vi.fn()} />)
      expect(screen.getByText('Caregiver review pending')).toBeTruthy()
      expect(screen.queryByText('Reviewed by caregiver')).toBeNull()
    }
  })

  it('keeps a matching but unsaved review visibly pending and retryable', () => {
    const current = session()
    const reviewed = { ...current, reviewedRevision: sessionRevision(current) }
    const onReview = vi.fn(() => false)
    const { rerender } = render(<SessionHandoff sessions={[reviewed]} onReview={onReview} saveError />)
    expect(screen.getByText('Review not saved')).toBeTruthy()
    expect(screen.queryByText('Reviewed by caregiver')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry saving review' }))
    expect(onReview).toHaveBeenCalledWith(current.id, sessionRevision(current))
    expect(screen.getByRole('alert').textContent).toMatch(/could not be saved/)
    // A global persistence retry can recover the same record too.
    rerender(<SessionHandoff sessions={[reviewed]} onReview={onReview} saveError={false} />)
    expect(screen.getByText('Reviewed by caregiver')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry saving review' })).toBeNull()
  })

  it('exposes exact source text, provenance and time while keeping IDs out of the default control', () => {
    const action = event('player-action-1', 'Included recording began playing.', { type: 'started', activity: 'music', source: 'player' })
    render(<SessionHandoff sessions={[session({ events: [action] })]} />)
    const summary = screen.getByText('View recorded action')
    expect(summary.textContent).not.toContain(action.id)
    const details = summary.closest('details')
    expect(within(details).getByText('Player-reported')).toBeTruthy()
    expect(within(details).getByText(action.text)).toBeTruthy()
    expect(within(details).getByText(action.id)).toBeTruthy()
    expect(details.querySelector('time').getAttribute('datetime')).toBe(action.at)
    expect(screen.getByText(/No observation entry with text was recorded/)).toBeTruthy()
    expect(screen.getByText('Sit beside me and speak slowly.')).toBeTruthy()
    expect(screen.getByText('Questions that test memory.')).toBeTruthy()
  })

  it('defaults to the latest session and lets the caregiver inspect an older session', () => {
    const older = session({ id: 'older', date: '2026-09-25', startedAt: '2026-09-25T22:00:00.000Z', events: [event('old-note', 'Earlier session note.')] })
    const latest = session({ events: [event('new-note', 'Current session note.')] })
    render(<SessionHandoff sessions={[older, latest]} />)
    expect(screen.getByText(/Caregiver observation: “Current session note.”/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Choose an evening session'), { target: { value: 'older' } })
    expect(screen.getByText(/Caregiver observation: “Earlier session note.”/)).toBeTruthy()
    expect(screen.queryByText(/Caregiver observation: “Current session note.”/)).toBeNull()
  })

  it('does not reinterpret malformed or ambiguous-source sessions as care records', () => {
    render(<SessionHandoff sessions={[null, {}, session({ isDemo: 'true' }), session({ date: '2026-02-30' }), session({ startedAt: 'later' })]} onReview={vi.fn()} />)
    expect(screen.getByText('No session handoff is available yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull()
  })

  it('supports keyboard movement between source tabs without mixing their records', () => {
    render(<SessionHandoff sessions={[session(), session({ id: 'example', isDemo: true })]} />)
    const recorded = screen.getByRole('tab', { name: 'Recorded sessions' })
    const example = screen.getByRole('tab', { name: 'Fictional examples' })
    fireEvent.keyDown(recorded, { key: 'ArrowRight' })
    expect(example.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(example)
    fireEvent.keyDown(example, { key: 'Home' })
    expect(recorded.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(recorded)
  })
})

it('opens the just-finished fictional session even when recorded sessions exist', () => {
  const example = session({ id:'finished-demo', isDemo:true, events:[event('demo-note','Fictional finish')] })
  render(<SessionHandoff sessions={[session(), example]} initialSessionId="finished-demo" />)
  expect(screen.getByRole('tab', { name:'Fictional examples' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByText(/Caregiver observation: “Fictional finish”/)).toBeTruthy()
})
