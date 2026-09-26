// Which evening does a moment belong to?
//
// Caregivers often log late. Anything before EVENING_ROLLOVER_HOUR (4 AM, device-local time)
// still counts as the previous evening, so a log at 12:30 AM lands on the right date with the
// right dusk. All arithmetic is by calendar day (new Date(y, m, d ± 1)), never ± 24 hours, so
// month/year ends and daylight-saving changes behave. Inputs are never mutated.
//
// Only evening grouping should use eveningDate. Live timestamps (countdowns, animation) stay `now`.

import { localDateString } from './sky.js'

export const EVENING_ROLLOVER_HOUR = 4

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime())
}

// Returns a new Date at device-local noon of the evening `now` belongs to.
// Before 04:00 that is the previous calendar day. Returns null for an invalid date.
export function eveningDate(now = new Date()) {
  if (!isValidDate(now)) return null
  const dayOffset = now.getHours() < EVENING_ROLLOVER_HOUR ? -1 : 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 12)
}

// 'HH:MM' (24-hour) picked on the Log screen -> ISO timestamp on the right night, or null.
// 00:00..03:59 means after midnight, i.e. the calendar day after `evening`.
// Returns null for an empty or malformed time, an invalid evening, or a local time that does
// not exist that night (skipped by a daylight-saving jump), rather than guessing.
export function episodeStartFromTime(evening, time) {
  if (!isValidDate(evening) || typeof time !== 'string') return null
  const match = TIME_PATTERN.exec(time)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  const dayOffset = h < EVENING_ROLLOVER_HOUR ? 1 : 0
  const start = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate() + dayOffset, h, m)
  if (start.getHours() !== h || start.getMinutes() !== m) return null
  return start.toISOString()
}

export { localDateString }
