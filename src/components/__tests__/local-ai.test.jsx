// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AiPrompts from '../AiPrompts.jsx'
import * as local from '../localAi.js'

vi.mock('../localAi.js', async original => ({ ...await original(), localAiStatus: vi.fn(), generateLocalPrompts: vi.fn() }))
const draft = 'What flowers grew near your childhood home?'
const state = { profile: { name: 'Private Person', birthYear: 1942, city: 'Dallas', lat: 32, lon: -96, anchors: { hometown: 'Dayton' } }, logs: [] }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); local.localAiStatus.mockResolvedValue({ configured: true }); local.generateLocalPrompts.mockResolvedValue([draft]) })
afterEach(cleanup)

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

it('discarding or leaving local drafts does not approve them', async () => {
  const update = vi.fn()
  await act(async () => render(<AiPrompts state={state} update={update} />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate prompts' })))
  fireEvent.click(screen.getByRole('button', { name: 'Skip prompt 1' }))
  expect(update).not.toHaveBeenCalled()
  expect(screen.queryByText(draft)).toBeNull()
})
