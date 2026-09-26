// Which evening does a moment belong to?
//
// Caregivers often log late. Anything before EVENING_ROLLOVER_HOUR (4 AM) still counts as
// the previous evening, so a log at 12:30 AM lands on the right date with the right dusk.

import { localDateString } from './sky.js'

export const EVENING_ROLLOVER_HOUR = 4

// Local noon of the evening that `now` belongs to.
export function eveningDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  if (now.getHours() < EVENING_ROLLOVER_HOUR) d.setDate(d.getDate() - 1)
  return d
}

// 'HH:MM' picked on the Log screen -> ISO timestamp on the right night.
// 00:00..03:59 means after midnight, i.e. the day after `evening`.
export function episodeStartFromTime(evening, hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Bad time: ${hhmm}`)
  }
  const d = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate(), h, m)
  if (h < EVENING_ROLLOVER_HOUR) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

export { localDateString }
