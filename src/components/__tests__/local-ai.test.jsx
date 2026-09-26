// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AiPrompts from '../AiPrompts.jsx'
import * as local from '../localAi.js'

vi.mock('../localAi.js', async original => ({ ...await original(), localAiStatus: vi.fn(), generateLocalPrompts: vi.fn() }))
const draft = 'What flowers grew near your childhood home?'
const state = { profile: { name: 'Private Person', birthYear: 1942, city: 'Dallas', lat: 32, lon: -96, anchors: { hometown: 'Dayton' } }, logs: [] }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); local.localAiStatus.mockResolvedValue({ configured: true }); local.generateLocalPrompts.mockResolvedValue([draft]) })
afterEach(cleanup)

function EditablePrompts({ initialState = state }) {
  const [current, update] = useState(initialState)
  return <AiPrompts state={current} update={update} />
}

it('uses the local connection without displaying, saving or sending an OpenAI key in the browser', async () => {
  const update = vi.fn(), anthropic = vi.fn()
  await act(async () => render(<AiPrompts state={state} update={update} generatePrompts={anthropic} />))
  expect(screen.getByText('Manage local OpenAI connection').getAttribute('href')).toBe('/connect')
  expect(screen.queryByLabelText('Anthropic API key')).toBeNull()
  expect(screen.getByText(/answers go to OpenAI through this laptop/)).toBeTruthy()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  expect(local.generateLocalPrompts).toHaveBeenCalledExactlyOnceWith(state.profile, { existing: [] })
  expect(anthropic).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
  expect(localStorage.length).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Approve prompt 1' }))
  expect(update).toHaveBeenCalledExactlyOnceWith({ ...state, approvedPrompts: [draft] })
})

it('keeps Generate disabled when the gateway has no configured key', async () => {
  local.localAiStatus.mockResolvedValue({ configured: false })
  localStorage.setItem('moonrise:ai-key', 'fictional-anthropic-key')
  await act(async () => render(<AiPrompts state={state} update={vi.fn()} />))
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(true)
  expect(screen.getByText('Connect OpenAI on this laptop')).toBeTruthy()
})

it('keeps the existing Anthropic path when no local gateway is detected', async () => {
  local.localAiStatus.mockResolvedValue(null)
  localStorage.setItem('moonrise:ai-key', 'fictional-anthropic-key')
  const anthropic = vi.fn().mockResolvedValue([draft])
  await act(async () => render(<AiPrompts state={state} update={vi.fn()} generatePrompts={anthropic} />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  expect(anthropic).toHaveBeenCalledExactlyOnceWith(state.profile, { apiKey: 'fictional-anthropic-key', existing: [] })
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
})

it.each([
  ['a configured local gateway', { configured: true }, 'local'],
  ['no local gateway', null, 'anthropic'],
])('waits for a delayed provider check confirming %s before generating', async (_, status, provider) => {
  let resolveStatus
  const pendingStatus = new Promise(resolve => { resolveStatus = resolve })
  local.localAiStatus.mockReturnValue(pendingStatus)
  // Fixture only: a saved alternate-provider key must not bypass the check.
  localStorage.setItem('moonrise:ai-key', 'fictional-anthropic-key')
  const anthropic = vi.fn().mockResolvedValue([draft])
  const update = vi.fn()
  render(<AiPrompts state={state} update={update} generatePrompts={anthropic} />)

  const generate = screen.getByRole('button', { name: 'Generate prompts' })
  expect(generate.disabled).toBe(true)
  expect(screen.getByText('Checking the optional connection…')).toBeTruthy()
  fireEvent.click(generate)
  expect(anthropic).not.toHaveBeenCalled()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()

  await act(async () => { resolveStatus(status); await pendingStatus })
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(false)
  // Resolving a provider check itself must not send profile details.
  expect(anthropic).not.toHaveBeenCalled()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  if (provider === 'local') {
    expect(local.generateLocalPrompts).toHaveBeenCalledExactlyOnceWith(state.profile, { existing: [] })
    expect(anthropic).not.toHaveBeenCalled()
  } else {
    expect(anthropic).toHaveBeenCalledExactlyOnceWith(state.profile, { apiKey: 'fictional-anthropic-key', existing: [] })
    expect(local.generateLocalPrompts).not.toHaveBeenCalled()
  }
  expect(update).not.toHaveBeenCalled()
})

it('disables generation during a focus check and ignores an older provider response', async () => {
  let resolveOlder, resolveLatest
  const olderCheck = new Promise(resolve => { resolveOlder = resolve })
  const latestCheck = new Promise(resolve => { resolveLatest = resolve })
  local.localAiStatus.mockResolvedValueOnce(null)
    .mockReturnValueOnce(olderCheck)
    .mockReturnValueOnce(latestCheck)
  localStorage.setItem('moonrise:ai-key', 'fictional-anthropic-key')
  const anthropic = vi.fn().mockResolvedValue([draft])
  await act(async () => render(<AiPrompts state={state} update={vi.fn()} generatePrompts={anthropic} />))
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(false)

  fireEvent.focus(window)
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' }))
  expect(anthropic).not.toHaveBeenCalled()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
  fireEvent.focus(window)
  expect(local.localAiStatus).toHaveBeenCalledTimes(3)

  await act(async () => { resolveLatest({ configured: true }); await latestCheck })
  expect(screen.getByRole('button', { name: 'Generate prompts' }).disabled).toBe(false)
  await act(async () => { resolveOlder(null); await olderCheck })
  expect(screen.getByText('Manage local OpenAI connection')).toBeTruthy()
  // A late absent-gateway response must not revert to the saved alternate key.
  expect(anthropic).not.toHaveBeenCalled()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  expect(local.generateLocalPrompts).toHaveBeenCalledExactlyOnceWith(state.profile, { existing: [] })
  expect(anthropic).not.toHaveBeenCalled()
})

it('discarding or leaving local drafts does not approve them', async () => {
  const update = vi.fn()
  await act(async () => render(<AiPrompts state={state} update={update} />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  fireEvent.click(screen.getByRole('button', { name: 'Skip prompt 1' }))
  expect(update).not.toHaveBeenCalled()
  expect(screen.queryByText(draft)).toBeNull()
})

it.each(['Approve', 'Skip'])('keeps focus on the next or previous %s action, then the section heading', async action => {
  local.generateLocalPrompts.mockResolvedValue([
    draft,
    'Tell me about a favourite weekend breakfast.',
    'What music did you enjoy at home?',
  ])
  await act(async () => render(<EditablePrompts />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  const previous = screen.getByRole('button', { name: `${action} prompt 1` })
  const middle = screen.getByRole('button', { name: `${action} prompt 2` })
  const next = screen.getByRole('button', { name: `${action} prompt 3` })

  middle.focus()
  fireEvent.click(middle)
  expect(document.activeElement).toBe(next)
  expect(next.getAttribute('aria-label')).toBe(`${action} prompt 2`)

  fireEvent.click(next)
  expect(document.activeElement).toBe(previous)

  fireEvent.click(previous)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Conversation starters' }))
  expect(screen.queryByRole('button', { name: /^(Approve|Skip) prompt/ })).toBeNull()
})

it('keeps surviving approved rows mounted and focuses the next removal, previous removal, or heading', async () => {
  await act(async () => render(<EditablePrompts initialState={{ ...state, approvedPrompts: [
    draft,
    'Tell me about a favourite weekend breakfast.',
    'What music did you enjoy at home?',
  ] }} />))
  const previous = screen.getByRole('button', { name: 'Remove approved prompt 1' })
  const middle = screen.getByRole('button', { name: 'Remove approved prompt 2' })
  const next = screen.getByRole('button', { name: 'Remove approved prompt 3' })

  middle.focus()
  fireEvent.click(middle)
  expect(document.activeElement).toBe(next)
  expect(next.getAttribute('aria-label')).toBe('Remove approved prompt 2')

  fireEvent.click(next)
  expect(document.activeElement).toBe(previous)

  fireEvent.click(previous)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Conversation starters' }))
  expect(screen.queryByRole('button', { name: /^Remove approved prompt/ })).toBeNull()
  expect(local.generateLocalPrompts).not.toHaveBeenCalled()
})
