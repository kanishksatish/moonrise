// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { AiPromptError, effectiveDusk, generateMemoryPrompts } from '../engine/index.js'

vi.mock('../engine/index.js', async original => ({
  ...await original(), effectiveDusk: vi.fn(), generateMemoryPrompts: vi.fn(),
}))

const profile = { name: 'Fictional Rose', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: { hometown: 'Dayton' } }
const first = 'What flowers grew near your childhood home?'
const second = 'Tell me about a favourite weekend breakfast.'
const saved = () => JSON.parse(localStorage.getItem('moonrise:v1'))
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 26, 18, 0))
  localStorage.clear()
  localStorage.setItem('moonrise:v1', JSON.stringify({ profile, logs: [] }))
  vi.clearAllMocks()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  effectiveDusk.mockResolvedValue({ sunset: new Date(2026, 8, 26, 19), effectiveDusk: new Date(2026, 8, 26, 19), cloudCover: null, shiftMinutes: 0, source: 'offline' })
  generateMemoryPrompts.mockResolvedValue([first, second])
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

async function openSettings(withKey = false) {
  if (withKey) localStorage.setItem('moonrise:ai-key', 'fictional-test-key')
  await act(async () => render(<App />))
  await act(async () => click('Settings'))
}

it('does not contact AI until Generate, and saves the key separately with the input cleared', async () => {
  await openSettings()
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(true)
  fireEvent.click(screen.getByText('Set up your API key'))
  const field = screen.getByLabelText('Anthropic API key')
  expect(field.type).toBe('password')
  fireEvent.change(field, { target: { value: '  fictional-test-key  ' } })
  click('Save key')
  expect(generateMemoryPrompts).not.toHaveBeenCalled()
  expect(localStorage.getItem('moonrise:ai-key')).toBe('fictional-test-key')
  expect(screen.getByLabelText('Replace Anthropic API key').value).toBe('')
  expect(JSON.stringify(saved())).not.toContain('fictional-test-key')
  await act(async () => click('Generate prompts'))
  expect(generateMemoryPrompts).toHaveBeenCalledExactlyOnceWith(
    { ...profile, anchors: { hometown: 'Dayton', spouse: '', job: '' } },
    { apiKey: 'fictional-test-key', existing: [] },
  )
  expect(saved().approvedPrompts).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(true)
})

it('keeps only approved drafts, survives reload, and shows an approved prompt in the routine', async () => {
  await openSettings(true)
  await act(async () => click('Generate prompts'))
  click('Approve prompt 1')
  click('Skip prompt 1')
  expect(saved().approvedPrompts).toEqual([first])
  expect(screen.queryByText(second)).toBeNull()
  cleanup()
  await act(async () => render(<App />))
  click('Start Moonrise now'); click('Skip launch')
  // Conversation is independent of the recording, so the approved prompt comes
  // first instead of naming an unrelated era song.
  expect(screen.getByText(first)).toBeTruthy()
  expect(screen.getByText('Conversation starter')).toBeTruthy()
  expect(screen.queryByText(second)).toBeNull()
})

it('removes approval and the API key independently without deleting logs or calling AI', async () => {
  localStorage.setItem('moonrise:v1', JSON.stringify({ profile, logs: [{ date: '2026-09-25', outcome: 'calm' }], approvedPrompts: [first] }))
  await openSettings(true)
  click('Remove approved prompt 1')
  expect(saved().approvedPrompts).toEqual([])
  fireEvent.click(screen.getByText('API key saved · manage key'))
  click('Remove key')
  expect(localStorage.getItem('moonrise:ai-key')).toBeNull()
  expect(saved().logs).toHaveLength(1)
  expect(generateMemoryPrompts).not.toHaveBeenCalled()
})

it('shows a safe actionable error and leaves the built-in routine usable', async () => {
  generateMemoryPrompts.mockRejectedValue(new AiPromptError('bad_key', 'That API key was not accepted. Check it in Settings.'))
  await openSettings(true)
  await act(async () => click('Generate prompts'))
  expect(screen.getByRole('alert').textContent).toMatch(/not accepted/)
  expect(saved().approvedPrompts).toBeUndefined()
  click('Today'); click('Start Moonrise now'); click('Skip launch')
  expect(screen.getByText('Conversation starter')).toBeTruthy()
})

it('prevents duplicate requests and ignores a late reply after leaving Settings', async () => {
  let resolve
  generateMemoryPrompts.mockImplementation(() => new Promise(done => { resolve = done }))
  await openSettings(true)
  click('Generate prompts')
  expect(screen.getByRole('button', { name: 'Writing prompts…' }).disabled).toBe(true)
  click('Writing prompts…')
  expect(generateMemoryPrompts).toHaveBeenCalledOnce()
  click('Today')
  await act(async () => resolve([first]))
  click('Settings')
  expect(screen.queryByText(first)).toBeNull()
  expect(saved().approvedPrompts).toBeUndefined()
})

it('does not claim a key was saved when browser storage fails', async () => {
  await openSettings()
  fireEvent.click(screen.getByText('Set up your API key'))
  fireEvent.change(screen.getByLabelText('Anthropic API key'), { target: { value: 'fictional-test-key' } })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable') })
  click('Save key')
  expect(screen.getByRole('alert').textContent).toMatch(/could not save the key/)
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(true)
})

it('Delete all data also removes the separately stored API key', async () => {
  await openSettings(true)
  click('Delete all data'); click('Yes, delete everything')
  expect(localStorage.getItem('moonrise:ai-key')).toBeNull()
  expect(saved()).toEqual({ profile: null, logs: [] })
  expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy()
})

it('keeps Settings and existing records visible when deletion cannot be saved', async () => {
  await openSettings(true)
  const before = saved()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable') })
  click('Delete all data'); click('Yes, delete everything')
  expect(saved()).toEqual(before)
  expect(screen.getByRole('heading', { name: 'Make it personal.' })).toBeTruthy()
  expect(screen.getByText(/profile and logs could not be deleted/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Start', exact: true })).toBeNull()
})

it('handles empty output without entering any prompt into a routine', async () => {
  generateMemoryPrompts.mockResolvedValue([])
  await openSettings(true)
  await act(async () => click('Generate prompts'))
  expect(screen.getByRole('status').textContent).toMatch(/No new prompts/)
  expect(screen.queryByText('Review before sharing')).toBeNull()
  expect(saved().approvedPrompts).toBeUndefined()
})
