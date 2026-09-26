// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerServiceWorker } from '../registerServiceWorker.js'

let serviceWorker
let ready
let resolveReady
let active
let online
let dispose
let previousDescriptor
const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve() }

beforeEach(() => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('BASE_URL', '/moonrise/')
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  online = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  ready = new Promise(resolve => { resolveReady = resolve })
  active = { postMessage: vi.fn() }
  serviceWorker = new EventTarget()
  Object.assign(serviceWorker, { controller: null, ready, register: vi.fn().mockResolvedValue({ active: null }) })
  previousDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker })
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  if (previousDescriptor) Object.defineProperty(navigator, 'serviceWorker', previousDescriptor)
  else delete navigator.serviceWorker
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('registers at the deployment base and starts optional audio only after activation', async () => {
  dispose = registerServiceWorker()
  await flush()
  expect(serviceWorker.register).toHaveBeenCalledWith('/moonrise/sw.js', { scope: '/moonrise/' })
  expect(active.postMessage).not.toHaveBeenCalled()
  resolveReady({ active })
  await flush()
  expect(active.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'MOONRISE_DOWNLOAD_AUDIO' })
})

it('resumes downloads on reconnection and controller activation without sending while offline', async () => {
  dispose = registerServiceWorker()
  resolveReady({ active })
  await flush()
  active.postMessage.mockClear()
  serviceWorker.controller = active
  online = false
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  expect(active.postMessage).not.toHaveBeenCalled()
  online = true
  window.dispatchEvent(new Event('online'))
  expect(active.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'MOONRISE_DOWNLOAD_AUDIO' })
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  expect(active.postMessage).toHaveBeenCalledTimes(2)
})

it('can retry installation after reconnection even if the first ready promise never resolves', async () => {
  dispose = registerServiceWorker()
  await flush()
  window.dispatchEvent(new Event('online'))
  await flush()
  expect(serviceWorker.register).toHaveBeenCalledTimes(2)
  expect(active.postMessage).not.toHaveBeenCalled()
})

it('does not register a production worker in the development server', () => {
  vi.stubEnv('PROD', false)
  dispose = registerServiceWorker()
  expect(serviceWorker.register).not.toHaveBeenCalled()
})
