import { useEffect, useRef, useState } from 'react'
import { moonriseStart } from '../engine/index.js'
import { eveningKey } from './eveningLog.js'
import { formatDuration } from './format.js'

const HEADS_UP_MS = 10 * 60000
const PERMISSIONS = new Set(['default', 'granted', 'denied'])

function readPermission() {
  try {
    if (typeof window.Notification !== 'function'
      || typeof window.Notification.requestPermission !== 'function') return 'unsupported'
    return PERMISSIONS.has(window.Notification.permission) ? window.Notification.permission : 'unsupported'
  } catch {
    return 'unsupported'
  }
}

// Mount once in App, not in a screen. Delivery is deduplicated per evening/stage
// during this open app lifetime; nothing is scheduled while the app is closed.
export default function useRoutineReminders({ now, sky, logs = [], suppressed = false }) {
  const [permission, setPermission] = useState(readPermission)
  const delivered = useRef(new Set())
  const mounted = useRef(true)
  const requesting = useRef(false)
  const nowMs = now instanceof Date ? now.getTime() : NaN
  const duskMs = sky?.effectiveDusk instanceof Date ? sky.effectiveDusk.getTime() : NaN
  const evening = Number.isFinite(nowMs) ? eveningKey(now) : null
  const recordedTonight = logs.some(log => log.date === evening && !log.demo)
  let stage = null
  let alertText = null

  if (!suppressed && !recordedTonight && evening && sky?.date === evening
    && Number.isFinite(duskMs) && nowMs <= duskMs) {
    const schedule = moonriseStart(sky.effectiveDusk, logs)
    const startMs = schedule.start.getTime()
    if (Number.isFinite(startMs)) {
      const remaining = startMs - nowMs
      if (remaining <= 0) {
        stage = 'start'
        alertText = 'It’s time. Start Moonrise now.'
      } else if (remaining <= HEADS_UP_MS) {
        stage = 'soon'
        alertText = `Moonrise starts in ${formatDuration(remaining)}. Time to settle in.`
      }
    }
  }

  useEffect(() => {
    mounted.current = true
    const refresh = () => setPermission(readPermission())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      mounted.current = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (!alertText || permission !== 'granted' || readPermission() !== 'granted') return
    const key = `${evening}:${stage}`
    if (delivered.current.has(key)) return
    try {
      new window.Notification('Moonrise', { body: alertText, tag: `moonrise:${key}` })
    } catch {
      // Keep the on-screen reminder. A rejected delivery does not consume its
      // stage; a later clock/permission update can retry while it is relevant.
      return
    }
    delivered.current.add(key)
    try { navigator.vibrate?.([200, 100, 200]) } catch { /* Optional, after delivery only. */ }
  }, [alertText, evening, stage, nowMs, permission])

  async function askPermission() {
    const current = readPermission()
    if (current !== 'default' || requesting.current) {
      if (mounted.current) setPermission(current)
      return current
    }
    requesting.current = true
    try {
      const result = await window.Notification.requestPermission()
      const next = PERMISSIONS.has(result) ? result : readPermission()
      if (mounted.current) setPermission(next)
      return next
    } catch {
      if (mounted.current) setPermission('denied')
      return 'denied'
    } finally {
      requesting.current = false
    }
  }

  return { permission, askPermission, alertText }
}
