// Sky engine: when does it actually get dark today?
//
// effectiveDusk formula:
//   cloudCover = average hourly cloud_cover (%) over the 2 hours before sunset
//   shiftMinutes = round(cloudCover / 100 * 30)
//   effectiveDusk = sunset - shiftMinutes
// So a fully overcast evening pulls dusk 30 minutes earlier; a clear one leaves it at sunset.

import { getTimes } from 'suncalc'

const MINUTE = 60 * 1000
const MAX_CLOUD_SHIFT_MINUTES = 30
const CLOUD_WINDOW_MINUTES = 120

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

// Main entry point. Fetches today's sunset and cloud cover, then computes effective dusk.
// If the network fails, falls back to SunCalc's sunset with no cloud shift (source: 'offline').
// Returns { sunset, cloudCover, shiftMinutes, effectiveDusk, source }.
export async function effectiveDusk(date, lat, lon, { fetchFn = globalThis.fetch } = {}) {
  try {
    const res = await fetchFn(openMeteoUrl(date, lat, lon))
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
    const { sunset, hourly } = parseOpenMeteo(await res.json())
    return { ...computeEffectiveDusk(sunset, hourly), source: 'open-meteo' }
  } catch {
    // Noon local time so SunCalc picks the right day's sunset.
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
    const sunset = getTimes(noon, lat, lon).sunset
    return { ...computeEffectiveDusk(sunset, []), source: 'offline' }
  }
}
