// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EveningWorkspace from '../EveningWorkspace.jsx'
import { deleteComfortPhoto, saveComfortPhoto } from '../../engine/comfortPhoto.js'

vi.mock('../../engine/comfortPhoto.js', async original => ({
  ...await original(), saveComfortPhoto: vi.fn(), deleteComfortPhoto: vi.fn(),
}))
vi.mock('../ComfortPhoto.jsx', () => ({ default: ({ id }) => id ? <span data-testid="photo-preview">{id}</span> : null }))

const profile = { name: 'Jo' }
const plan = { photoId: 'existing-plan-photo' }
const button = name => screen.getByRole('button', { name })
const click = name => fireEvent.click(button(name))
const file = (type = 'image/jpeg') => new File(['fixture'], 'fixture.jpg', { type })
const chooseFile = async value => {
  await act(async () => fireEvent.change(screen.getByLabelText(/A familiar photo/), { target: { files: [value] } }))
}
const openEditor = (onSave = vi.fn(() => true)) => {
  const result = render(<EveningWorkspace profile={profile} plan={plan} onSave={onSave} onStart={vi.fn()}/>)
  click(/Prepare their evening/)
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  saveComfortPhoto.mockResolvedValue({ id: 'new-draft-photo' })
  deleteComfortPhoto.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('unsubmitted photo ownership', () => {
  it('removes a cancelled draft photo, preserves the existing plan photo, and restores focus', async () => {
    const onSave = vi.fn()
    const { unmount } = openEditor(onSave)
    await chooseFile(file())
    await act(async () => click('Cancel'))
    expect(deleteComfortPhoto).toHaveBeenCalledExactlyOnceWith('new-draft-photo')
    expect(onSave).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(button(/Prepare their evening/))
    expect(screen.queryByText('new-draft-photo')).toBeNull()
    unmount()
    expect(deleteComfortPhoto).toHaveBeenCalledOnce()
  })

  it('never deletes an existing plan photo when removing it from the draft or closing preparation', async () => {
    const { unmount } = openEditor()
    await act(async () => click('Remove from this plan'))
    await act(async () => click(/Close preparation/))
    unmount()
    expect(deleteComfortPhoto).not.toHaveBeenCalled()
  })

  it('releases a replaced draft before adding another and removes only the remaining draft on unmount', async () => {
    saveComfortPhoto.mockResolvedValueOnce({ id: 'draft-one' }).mockResolvedValueOnce({ id: 'draft-two' })
    const { unmount } = openEditor()
    await chooseFile(file())
    await chooseFile(file())
    expect(deleteComfortPhoto).toHaveBeenCalledExactlyOnceWith('draft-one')
    expect(deleteComfortPhoto.mock.invocationCallOrder[0]).toBeLessThan(saveComfortPhoto.mock.invocationCallOrder[1])
    await act(async () => unmount())
    expect(deleteComfortPhoto.mock.calls).toEqual([['draft-one'], ['draft-two']])
  })

  it('retains a submitted photo after a successful save and returns focus to preparation', async () => {
    const onSave = vi.fn(() => true)
    const { unmount } = openEditor(onSave)
    await chooseFile(file())
    click('Save evening plan')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoId: 'new-draft-photo' }))
    expect(document.activeElement).toBe(button(/Prepare their evening/))
    unmount()
    expect(deleteComfortPhoto).not.toHaveBeenCalled()
  })

  it('retains a submitted photo on save failure, including when replaced and cancelled afterward', async () => {
    saveComfortPhoto.mockResolvedValueOnce({ id: 'submitted-photo' }).mockResolvedValueOnce({ id: 'unused-replacement' })
    const onSave = vi.fn(() => false)
    const { unmount } = openEditor(onSave)
    await chooseFile(file())
    click('Save evening plan')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photoId: 'submitted-photo' }))
    expect(screen.getByRole('region', { name: 'Evening plan editor' })).toBeTruthy()
    await chooseFile(file())
    expect(deleteComfortPhoto).not.toHaveBeenCalled()
    await act(async () => click('Cancel'))
    unmount()
    expect(deleteComfortPhoto).toHaveBeenCalledExactlyOnceWith('unused-replacement')
  })

  it('cleans up a photo that finishes importing after the caregiver has navigated away', async () => {
    let finishPhoto
    saveComfortPhoto.mockImplementationOnce(() => new Promise(resolve => { finishPhoto = resolve }))
    const { unmount } = openEditor()
    await chooseFile(file())
    expect(saveComfortPhoto).toHaveBeenCalledOnce()
    unmount()
    await act(async () => finishPhoto({ id: 'late-unused-photo' }))
    expect(deleteComfortPhoto).toHaveBeenCalledExactlyOnceWith('late-unused-photo')
  })

  it('keeps the existing draft photo when a replacement has an invalid file type', async () => {
    openEditor()
    await chooseFile(file())
    await chooseFile(file('image/gif'))
    expect(saveComfortPhoto).toHaveBeenCalledOnce()
    expect(deleteComfortPhoto).not.toHaveBeenCalled()
    expect(screen.getByText('new-draft-photo')).toBeTruthy()
    expect(screen.getByText('Choose a JPEG, PNG, or WebP photo.')).toBeTruthy()
  })

  it('removes a new unsubmitted photo when Remove from this plan is chosen', async () => {
    const { unmount } = openEditor()
    await chooseFile(file())
    await act(async () => click('Remove from this plan'))
    expect(deleteComfortPhoto).toHaveBeenCalledExactlyOnceWith('new-draft-photo')
    unmount()
    expect(deleteComfortPhoto).toHaveBeenCalledOnce()
  })
})
