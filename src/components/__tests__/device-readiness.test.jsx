// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceReadiness from '../DeviceReadiness.jsx'
import useOfflineAudioStatus from '../useOfflineAudioStatus.js'
import { bundledMusic } from '../bundledMusic.js'

vi.mock('../useOfflineAudioStatus.js', () => ({ default: vi.fn() }))

let requestDownload
beforeEach(() => {
  vi.clearAllMocks()
  requestDownload = vi.fn()
  useOfflineAudioStatus.mockReturnValue({
    online: true, known: true, readyCount: 0, downloading: false, requestDownload,
  })
})
afterEach(cleanup)

function show(status) {
  useOfflineAudioStatus.mockReturnValue({
    online: true, known: true, readyCount: 0, downloading: false, requestDownload, ...status,
  })
  return render(<DeviceReadiness />)
}

describe('device readiness uses confirmed offline availability', () => {
  it('does not claim readiness when availability is unknown, even if a stale count is complete', () => {
    show({ known: false, readyCount: 11 })
    expect(screen.getByText('Checking saved music')).toBeTruthy()
    expect(screen.getByText('Offline availability is not confirmed yet')).toBeTruthy()
    expect(screen.queryByText('11 of 11 recordings')).toBeNull()
    expect(screen.queryByText('Saved for offline listening', { exact: true })).toBeNull()
    expect(document.querySelector('.device-meter.is-ready')).toBeNull()
  })

  it('shows the exact partial count without saying the library is complete', () => {
    show({ readyCount: 3 })
    expect(screen.getByText('3 of 11 recordings')).toBeTruthy()
    expect(screen.getByText('Saved for offline listening so far')).toBeTruthy()
    expect(screen.queryByText('Saved for offline listening', { exact: true })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save music for offline use' })).toBeTruthy()
    expect(document.querySelector('.device-meter.is-ready')).toBeNull()
  })

  it('marks all eleven confirmed recordings ready, including while offline', () => {
    expect(bundledMusic).toHaveLength(11)
    show({ online: false, readyCount: 11 })
    expect(useOfflineAudioStatus).toHaveBeenCalledWith(bundledMusic)
    expect(screen.getByText('11 of 11 recordings')).toBeTruthy()
    expect(screen.getByText('Saved for offline listening', { exact: true })).toBeTruthy()
    expect(document.querySelector('.device-meter.is-ready')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save music for offline use' })).toBeNull()
    expect(screen.getByText(/Browsers can remove saved files/)).toBeTruthy()
  })

  it('disables retry while offline and does not request a download', () => {
    show({ online: false, readyCount: 3 })
    const retry = screen.getByRole('button', { name: 'Save music for offline use' })
    expect(retry.disabled).toBe(true)
    fireEvent.click(retry)
    expect(requestDownload).not.toHaveBeenCalled()
    expect(screen.getByText(/Reconnect to save more recordings/)).toBeTruthy()
  })

  it('passes an explicit online retry to the offline-audio hook', () => {
    show({ readyCount: 3 })
    const retry = screen.getByRole('button', { name: 'Save music for offline use' })
    expect(retry.disabled).toBe(false)
    expect(requestDownload).not.toHaveBeenCalled()
    fireEvent.click(retry)
    expect(requestDownload).toHaveBeenCalledOnce()
  })

  it('does not enqueue another retry while a download is in progress', () => {
    show({ readyCount: 3, downloading: true })
    const retry = screen.getByRole('button', { name: 'Saving music…' })
    expect(retry.disabled).toBe(true)
    fireEvent.click(retry)
    expect(requestDownload).not.toHaveBeenCalled()
  })
})
