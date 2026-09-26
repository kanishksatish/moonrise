// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MusicPlayer from '../MusicPlayer.jsx'
import { bundledMusic } from '../bundledMusic.js'
import useOfflineAudioStatus, { AUDIO_STATUS_TIMEOUT_MS } from '../useOfflineAudioStatus.js'

const recordings = bundledMusic.slice(0, 2)
const url = recording => new URL(recording.src, window.location.href).href
const packet = (saved, downloading = false) => ({
  type: 'MOONRISE_AUDIO_STATUS', version: 1, cachedUrls: saved.map(url), downloading,
})
let serviceWorker
let controller
let online
let response
let ports
let previousDescriptor

beforeEach(() => {
  vi.useFakeTimers()
  online = true
  response = null
  ports = []
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.stubGlobal('MessageChannel', class {
    constructor() {
      this.port1 = { onmessage: null, close: vi.fn() }
      this.port2 = { close: vi.fn(), reply: data => this.port1.onmessage?.({ data }) }
    }
  })
  controller = { postMessage: vi.fn((message, transfer) => {
    if (message.type !== 'MOONRISE_AUDIO_STATUS') return
    ports.push(transfer[0])
    if (response) transfer[0].reply(response)
  }) }
  serviceWorker = new EventTarget()
  serviceWorker.controller = controller
  previousDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker })
})

afterEach(() => {
  cleanup()
  if (previousDescriptor) Object.defineProperty(navigator, 'serviceWorker', previousDescriptor)
  else delete navigator.serviceWorker
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function broadcast(data, source = controller) {
  const event = new Event('message')
  Object.assign(event, { data, source })
  act(() => serviceWorker.dispatchEvent(event))
}

it('times out unsupported workers as unknown, including the core piano', () => {
  const { result, unmount } = renderHook(() => useOfflineAudioStatus(recordings))
  expect(result.current.statusFor(recordings[0].src)).toBe('unknown')
  act(() => vi.advanceTimersByTime(AUDIO_STATUS_TIMEOUT_MS))
  expect(result.current.known).toBe(false)
  expect(result.current.statusFor(recordings[0].src)).toBe('unknown')
  unmount()
  act(() => ports[0].reply(packet(recordings)))
})

it('reports exact approved URLs, accepts progress, and ignores another worker', () => {
  response = { ...packet([recordings[0]], true), cachedUrls: [url(recordings[0]), 'https://unrelated.example/song.mp3'] }
  const { result } = renderHook(() => useOfflineAudioStatus(recordings))
  expect(result.current.readyCount).toBe(1)
  expect(result.current.statusFor(recordings[0].src)).toBe('ready')
  expect(result.current.statusFor(recordings[1].src)).toBe('missing')
  broadcast(packet(recordings), { postMessage() {} })
  expect(result.current.readyCount).toBe(1)
  broadcast(packet(recordings))
  expect(result.current.readyCount).toBe(2)
  expect(result.current.downloading).toBe(false)
  act(() => vi.advanceTimersByTime(AUDIO_STATUS_TIMEOUT_MS))
  expect(result.current.readyCount).toBe(2)
})

it('keeps malformed or obsolete worker responses from marking audio ready', () => {
  const { result } = renderHook(() => useOfflineAudioStatus(recordings))
  const oldPort = ports[0]
  act(() => oldPort.reply({ ...packet(recordings), version: 2 }))
  expect(result.current.known).toBe(false)
  serviceWorker.controller = { postMessage: vi.fn() }
  act(() => serviceWorker.dispatchEvent(new Event('controllerchange')))
  act(() => oldPort.reply(packet(recordings)))
  broadcast(packet(recordings), controller)
  expect(result.current.known).toBe(false)
})

it('offers the cached piano when an offline selection is missing without recording a play', () => {
  online = false
  response = packet([recordings[0]])
  const onPlayed = vi.fn()
  render(<MusicPlayer recordings={recordings} onPlayed={onPlayed} />)
  const picker = screen.getByRole('combobox', { name: 'Choose an included recording' })
  expect(screen.getAllByRole('option')[0].textContent).toContain('Ready offline')
  expect(screen.getAllByRole('option')[1].textContent).toContain('Not downloaded')
  fireEvent.change(picker, { target: { value: recordings[1].id } })
  expect(screen.getByRole('alert').textContent).toContain('has not been saved')
  fireEvent.click(screen.getByRole('button', { name: 'Choose Für Elise' }))
  expect(picker.value).toBe(recordings[0].id)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(document.querySelector('audio').autoplay).toBe(false)
  expect(onPlayed).not.toHaveBeenCalled()
})

it('requests a background retry online and never treats native playback as a cache confirmation', () => {
  response = packet([recordings[0]])
  render(<MusicPlayer recordings={recordings} />)
  const picker = screen.getByRole('combobox', { name: 'Choose an included recording' })
  fireEvent.change(picker, { target: { value: recordings[1].id } })
  const audio = document.querySelector('audio')
  fireEvent.playing(audio)
  expect(screen.getAllByRole('option')[1].textContent).toContain('Not downloaded')
  fireEvent.click(screen.getByRole('button', { name: 'Download for offline use' }))
  expect(controller.postMessage).toHaveBeenCalledWith({ type: 'MOONRISE_DOWNLOAD_AUDIO' })
  expect(document.querySelector('audio')).toBe(audio)
  broadcast(packet(recordings))
  expect(screen.getByText('2 of 2 recordings ready offline.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Download for offline use' })).toBeNull()
})

it('updates failed-download status and keeps unknown availability honest when disconnected', () => {
  response = packet([recordings[0]], true)
  render(<MusicPlayer recordings={recordings} />)
  expect(screen.getByText(/Downloading for offline use/)).toBeTruthy()
  broadcast(packet([recordings[0]], false))
  expect(screen.getByText(/remaining recordings have not been downloaded/)).toBeTruthy()
  online = false
  response = null
  act(() => window.dispatchEvent(new Event('offline')))
  act(() => vi.advanceTimersByTime(AUDIO_STATUS_TIMEOUT_MS))
  expect(screen.getByText(/Offline availability has not been confirmed/)).toBeTruthy()
  expect(screen.getAllByRole('option')[0].textContent).toContain('Offline status unknown')
  expect(screen.queryByRole('button', { name: 'Download for offline use' })).toBeNull()
})
