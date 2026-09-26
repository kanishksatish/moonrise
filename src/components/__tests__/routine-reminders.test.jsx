// @vitest-environment jsdom
process.env.TZ = 'America/Chicago'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useRoutineReminders from '../useRoutineReminders.js'

const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute)
const skyFor = day => ({ date: `2026-09-${day}`, effectiveDusk: at(day, 19, 15) })
const initial = () => ({ now: at(26, 18, 20), sky: skyFor(26), logs: [], suppressed: false })
let permission, notification, requestPermission, vibrate, previousVibrate

beforeEach(() => {
  permission = 'granted'
  notification = vi.fn()
  requestPermission = vi.fn(async () => { permission = 'granted'; return permission })
  vi.stubGlobal('Notification', class {
    static get permission() { return permission }
    static requestPermission() { return requestPermission() }
    constructor(title, options) { notification(title, options) }
  })
  vibrate = vi.fn()
  previousVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate')
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
})

afterEach(() => {
  cleanup()
  if (previousVibrate) Object.defineProperty(navigator, 'vibrate', previousVibrate)
  else delete navigator.vibrate
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('open-app routine reminders', () => {
  it('delivers each stage once while keeping the on-screen countdown current', () => {
    const props = { ...initial(), now: at(26, 18, 19) }
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: props })
    expect(result.current.alertText).toBeNull()
    expect(notification).not.toHaveBeenCalled()
    rerender({ ...props, now: at(26, 18, 20) })
    expect(result.current.alertText).toBe('Moonrise starts in 10 min. Time to settle in.')
    expect(notification).toHaveBeenCalledExactlyOnceWith('Moonrise', {
      body: result.current.alertText, tag: 'moonrise:2026-09-26:soon',
    })
    rerender({ ...props, now: at(26, 18, 21) })
    expect(result.current.alertText).toBe('Moonrise starts in 9 min. Time to settle in.')
    expect(notification).toHaveBeenCalledOnce()
    rerender({ ...props, now: at(26, 18, 30) })
    expect(result.current.alertText).toBe('It’s time. Start Moonrise now.')
    expect(notification).toHaveBeenCalledTimes(2)
    rerender({ ...props, now: at(26, 18, 31) })
    expect(notification).toHaveBeenCalledTimes(2)
    expect(vibrate).toHaveBeenCalledTimes(2)
    rerender({ ...props, now: at(26, 19, 16) })
    expect(result.current.alertText).toBeNull()
    expect(notification).toHaveBeenCalledTimes(2)
  })

  it('reevaluates the active stage after an explicit permission grant without consuming it earlier', async () => {
    permission = 'default'
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    expect(result.current.permission).toBe('default')
    expect(result.current.alertText).toBeTruthy()
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    await act(async () => { await result.current.askPermission() })
    expect(result.current.permission).toBe('granted')
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(notification).toHaveBeenCalledOnce()
    expect(vibrate).toHaveBeenCalledOnce()
    rerender({ ...initial(), now: at(26, 18, 22) })
    expect(notification).toHaveBeenCalledOnce()
  })

  it('reflects externally changed permission on focus and visibility changes', () => {
    permission = 'denied'
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    permission = 'granted'
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.permission).toBe('granted')
    expect(notification).toHaveBeenCalledOnce()
    permission = 'denied'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.permission).toBe('denied')
    rerender({ ...initial(), now: at(26, 18, 30) })
    expect(notification).toHaveBeenCalledOnce()
    permission = 'granted'
    act(() => window.dispatchEvent(new Event('focus')))
    expect(notification).toHaveBeenCalledTimes(2)
    expect(notification.mock.lastCall[1].body).toBe('It’s time. Start Moonrise now.')
  })

  it('suppresses both delivery and the banner without consuming an undelivered stage', () => {
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: { ...initial(), suppressed: true } })
    expect(result.current.alertText).toBeNull()
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    rerender(initial())
    expect(notification).toHaveBeenCalledOnce()
    rerender({ ...initial(), suppressed: true })
    expect(result.current.alertText).toBeNull()
    rerender(initial())
    expect(notification).toHaveBeenCalledOnce()
  })

  it('suppresses a real observation but not a fictional example for tonight', () => {
    const log = { date: '2026-09-26', outcome: 'calm' }
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: { ...initial(), logs: [log] } })
    expect(result.current.alertText).toBeNull()
    expect(notification).not.toHaveBeenCalled()
    rerender({ ...initial(), logs: [{ ...log, demo: true }] })
    expect(result.current.alertText).toBeTruthy()
    expect(notification).toHaveBeenCalledOnce()
  })

  it('uses evening dates through midnight and permits the next evening’s reminder only with its own sky', () => {
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    expect(notification).toHaveBeenCalledOnce()
    rerender({ ...initial(), now: at(27, 0, 30) })
    expect(result.current.alertText).toBeNull()
    rerender({ ...initial(), now: at(27, 4) })
    expect(result.current.alertText).toBeNull()
    expect(notification).toHaveBeenCalledOnce()
    rerender({ ...initial(), now: at(27, 4), sky: skyFor(27) })
    expect(result.current.alertText).toBeNull()
    rerender({ ...initial(), now: at(27, 18, 20), sky: skyFor(27) })
    expect(notification).toHaveBeenCalledTimes(2)
    expect(notification.mock.lastCall[1].tag).toBe('moonrise:2026-09-27:soon')
  })

  it.each([
    ['missing sky', { sky: null }],
    ['invalid dusk', { sky: { ...skyFor(26), effectiveDusk: new Date('invalid') } }],
    ['non-Date dusk', { sky: { ...skyFor(26), effectiveDusk: Infinity } }],
    ['stale sky date', { sky: skyFor(25) }],
    ['invalid current time', { now: new Date('invalid') }],
  ])('does not deliver or consume a reminder with %s', (_, invalid) => {
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: { ...initial(), ...invalid } })
    expect(result.current.alertText).toBeNull()
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    rerender(initial())
    expect(notification).toHaveBeenCalledOnce()
  })

  it('does not mark a rejected notification delivered or vibrate until a later successful attempt', () => {
    notification.mockImplementationOnce(() => { throw new Error('Notification unavailable') })
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    expect(result.current.alertText).toBeTruthy()
    expect(vibrate).not.toHaveBeenCalled()
    rerender({ ...initial(), now: at(26, 18, 21) })
    expect(notification).toHaveBeenCalledTimes(2)
    expect(vibrate).toHaveBeenCalledOnce()
    rerender({ ...initial(), now: at(26, 18, 22) })
    expect(notification).toHaveBeenCalledTimes(2)
  })

  it('does not repeat a delivered reminder when optional vibration fails', () => {
    vibrate.mockImplementation(() => { throw new Error('Vibration unavailable') })
    const { rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    rerender({ ...initial(), now: at(26, 18, 21) })
    expect(notification).toHaveBeenCalledOnce()
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('does not deliver a late permission grant after suppression starts', async () => {
    permission = 'default'
    let resolvePermission
    requestPermission.mockReturnValue(new Promise(resolve => { resolvePermission = resolve }))
    const { result, rerender } = renderHook(useRoutineReminders, { initialProps: initial() })
    let pending
    act(() => { pending = result.current.askPermission() })
    rerender({ ...initial(), suppressed: true })
    await act(async () => { permission = 'granted'; resolvePermission('granted'); await pending })
    expect(result.current.permission).toBe('granted')
    expect(result.current.alertText).toBeNull()
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('keeps an on-screen reminder when notifications are unsupported or permission fails', async () => {
    vi.stubGlobal('Notification', undefined)
    const unsupported = renderHook(useRoutineReminders, { initialProps: initial() })
    expect(unsupported.result.current.permission).toBe('unsupported')
    expect(unsupported.result.current.alertText).toBeTruthy()
    await act(async () => { await unsupported.result.current.askPermission() })
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
    unsupported.unmount()

    permission = 'default'
    vi.stubGlobal('Notification', class {
      static get permission() { return permission }
      static requestPermission() { return Promise.reject(new Error('Permission unavailable')) }
      constructor(title, options) { notification(title, options) }
    })
    const rejected = renderHook(useRoutineReminders, { initialProps: initial() })
    await act(async () => { await rejected.result.current.askPermission() })
    expect(rejected.result.current.permission).toBe('denied')
    expect(rejected.result.current.alertText).toBeTruthy()
    expect(notification).not.toHaveBeenCalled()
    expect(vibrate).not.toHaveBeenCalled()
  })
})
