// Moon and live sky state for the Today card and Moonrise mode.
//
// darkness comes from the sun's altitude:
//   altitude >= +6 degrees  -> 0 (daylight)
//   altitude <= -12 degrees -> 1 (night, end of nautical twilight)
//   linear in between.
// warmth = darkness, brightness = 0.5 + 0.5 * darkness. So the screen gets warmer and brighter
// as the real sky gets darker, which is the whole point of Moonrise mode.

import { getMoonIllumination, getPosition } from 'suncalc'

const DAY_ALTITUDE = 6
const NIGHT_ALTITUDE = -12

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
]

// phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
export function phaseName(phase) {
  const index = Math.round(phase * 8) % 8
  return PHASE_NAMES[index]
}

// Returns { phase: 0..1, illumination: 0..1, name }.
export function moonPhase(date = new Date()) {
  const { phase, fraction } = getMoonIllumination(date)
  return { phase, illumination: fraction, name: phaseName(phase) }
}

export function darknessFromAltitude(altitudeDegrees) {
  const t = (DAY_ALTITUDE - altitudeDegrees) / (DAY_ALTITUDE - NIGHT_ALTITUDE)
  return Math.min(1, Math.max(0, t))
}

// Sky gradient stops: day blue -> dusk (purple over orange) -> night navy.
const SKY_STOPS = [
  { at: 0, top: '#4a90d9', bottom: '#bcdcf5' },
  { at: 0.5, top: '#3b3a78', bottom: '#f28c50' },
  { at: 1, top: '#0b1030', bottom: '#26204a' },
]

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// { top, bottom } hex colors for a darkness value 0..1.
export function skyGradient(darkness) {
  const d = Math.min(1, Math.max(0, darkness))
  const i = d <= SKY_STOPS[1].at ? 0 : 1
  const lo = SKY_STOPS[i]
  const hi = SKY_STOPS[i + 1]
  const t = (d - lo.at) / (hi.at - lo.at)
  return { top: mixHex(lo.top, hi.top, t), bottom: mixHex(lo.bottom, hi.bottom, t) }
}

// Everything Moonrise mode needs to paint the real sky right now.
// Returns { sunAltitude (degrees), darkness, warmth, brightness, gradient: { top, bottom } }.
export function skyState(date, lat, lon) {
  const sunAltitude = (getPosition(date, lat, lon).altitude * 180) / Math.PI
  const darkness = darknessFromAltitude(sunAltitude)
  return {
    sunAltitude,
    darkness,
    warmth: darkness,
    brightness: 0.5 + 0.5 * darkness,
    gradient: skyGradient(darkness),
  }
}
