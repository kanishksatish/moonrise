// Sky engine: when does it actually get dark today?
//
// effectiveDusk formula:
//   cloudCover = average hourly cloud_cover (%) over the 2 hours before sunset
//   shiftMinutes = round(cloudCover / 100 * 30)
//   effectiveDusk = sunset - shiftMinutes
// So a fully overcast evening pulls dusk 30 minutes earlier; a clear one leaves it at sunset.

import { getTimes } from 'suncalc'
import { DEFAULT_TIMEOUT_MS, fetchJson } from './net.js'

const MINUTE = 60 * 1000
const MAX_CLOUD_SHIFT_MINUTES = 30
const CLOUD_WINDOW_MINUTES = 120
// Give up on the weather after this long and use the offline sunset, so a slow
// connection never leaves the caregiver staring at a loading screen.
export const WEATHER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS

// YYYY-MM-DD from the device's local calendar date.
export function localDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Average cloud cover (%) for hourly samples in [sunset - 2h, sunset].
// hourly: [{ time: Date, cloudCover: number }]. Returns null if there is no usable data.
export function cloudCoverBeforeSunset(sunset, hourly) {
  const start = sunset.getTime() - CLOUD_WINDOW_MINUTES * MINUTE
  const end = sunset.getTime()
  const inWindow = hourly.filter(
    (h) => h.time.getTime() >= start && h.time.getTime() <= end && Number.isFinite(h.cloudCover)
  )
  if (inWindow.length === 0) return null
  const total = inWindow.reduce((sum, h) => sum + h.cloudCover, 0)
  return total / inWindow.length
}

// Shift in whole minutes for a cloud cover percentage. Unknown cloud cover means no shift.
export function cloudShiftMinutes(cloudCoverPercent) {
  if (!Number.isFinite(cloudCoverPercent)) return 0
  const clamped = Math.min(100, Math.max(0, cloudCoverPercent))
  return Math.round((clamped / 100) * MAX_CLOUD_SHIFT_MINUTES)
}

// Pure core: sunset + hourly cloud samples -> effective dusk details.
export function computeEffectiveDusk(sunset, hourly) {
  const cloudCover = cloudCoverBeforeSunset(sunset, hourly)
  const shiftMinutes = cloudShiftMinutes(cloudCover)
  return {
    sunset,
    cloudCover,
    shiftMinutes,
    effectiveDusk: new Date(sunset.getTime() - shiftMinutes * MINUTE),
  }
}

// Open-Meteo request for one local day. unixtime keeps timestamps unambiguous;
// timezone=auto makes "daily" mean the location's own calendar day.
export function openMeteoUrl(date, lat, lon) {
  const day = localDateString(date)
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'sunset',
    hourly: 'cloud_cover',
    timezone: 'auto',
    timeformat: 'unixtime',
    start_date: day,
    end_date: day,
  })
  return `https://api.open-meteo.com/v1/forecast?${params}`
}

// Turn an Open-Meteo JSON response into { sunset: Date, hourly: [{ time, cloudCover }] }.
export function parseOpenMeteo(json) {
  const sunsetSeconds = json?.daily?.sunset?.[0]
  if (!Number.isFinite(sunsetSeconds)) throw new Error('Open-Meteo response has no sunset')
  const times = json?.hourly?.time ?? []
  const clouds = json?.hourly?.cloud_cover ?? []
  return {
    sunset: new Date(sunsetSeconds * 1000),
    hourly: times.map((t, i) => ({ time: new Date(t * 1000), cloudCover: clouds[i] })),
  }
}

// Last good weather result per day and place, kept for this page session. If a later
// refresh fails (flaky wifi mid-evening), we keep the cloud-adjusted dusk instead of
// jumping back to the plain sunset and moving the start time around.
const lastGood = new Map()

function cacheKey(date, lat, lon) {
  return `${localDateString(date)}|${lat.toFixed(2)}|${lon.toFixed(2)}`
}

export function clearWeatherCache() {
  lastGood.clear()
}

// Main entry point. Fetches today's sunset and cloud cover, then computes effective dusk.
// If the network fails or takes longer than WEATHER_TIMEOUT_MS, falls back to SunCalc's
// sunset with no cloud shift (source: 'offline'), unless this session already has good
// weather for the same day and place, which is reused (source: 'open-meteo', cached: true).
// Returns { sunset, cloudCover, shiftMinutes, effectiveDusk, source, cached? }.
export async function effectiveDusk(
  date,
  lat,
  lon,
  { fetchFn = globalThis.fetch, timeoutMs = WEATHER_TIMEOUT_MS } = {}
) {
  try {
    const json = await fetchJson(openMeteoUrl(date, lat, lon), { fetchFn, timeoutMs })
    const { sunset, hourly } = parseOpenMeteo(json)
    const result = { ...computeEffectiveDusk(sunset, hourly), source: 'open-meteo' }
    lastGood.set(cacheKey(date, lat, lon), result)
    return result
  } catch {
    const cached = lastGood.get(cacheKey(date, lat, lon))
    if (cached) return { ...cached, cached: true }
    // Noon local time so SunCalc picks the right day's sunset.
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
    const sunset = getTimes(noon, lat, lon).sunset
    return { ...computeEffectiveDusk(sunset, []), source: 'offline' }
  }
}
