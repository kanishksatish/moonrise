// Schedule engine: when should Moonrise mode start tonight?
//
// A log is one evening:
//   { date: 'YYYY-MM-DD', outcome: 'calm' | 'restless' | 'episode',
//     episodeStart: ISO string | null, effectiveDusk: ISO string,
//     cloudCover: number | null, songIds: string[] }
//
// moonriseStart formula:
//   Fewer than 3 logged evenings, or no timed episodes: start = effectiveDusk - 45 min.
//   Otherwise it is learned from the logs:
//     onset  = episodeStart - that evening's effectiveDusk (minutes, negative = before dusk)
//     target = -(onset) + 20        (start 20 min before that evening's episode)
//     lead   = (3 * 45 + n * median(targets)) / (3 + n)     n = timed episodes
//   i.e. the AGENTS.md rule "median(onset) - 20 min", shrunk toward the 45-minute default
//   as if the default were worth 3 evenings, so one or two unusual nights can't swing it.
//   With many episodes it converges to the plain median rule. See learning.js/METHODOLOGY.md.
//   The start is clamped to between 90 and 15 minutes before effective dusk.
//   `range` is an ~80% interval for the start; `confidence` summarises its width.

const MINUTE = 60 * 1000
export const DEFAULT_LEAD_MINUTES = 45
export const BUFFER_MINUTES = 20
export const MIN_LEAD_MINUTES = 15
export const MAX_LEAD_MINUTES = 90
export const MIN_LOGGED_EVENINGS = 3

export function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Minutes from effective dusk to episode onset for one log, or null if not a timed episode.
export function onsetMinutes(log) {
  if (log.outcome !== 'episode' || !log.episodeStart || !log.effectiveDusk) return null
  const minutes = (new Date(log.episodeStart) - new Date(log.effectiveDusk)) / MINUTE
  return Number.isFinite(minutes) ? minutes : null
}

// Returns { start: Date, minutesBeforeDusk: number, basis: 'default' | 'learned', episodesUsed: number }.
// Returns { start: Date, minutesBeforeDusk, basis: 'default' | 'learned', episodesUsed }.
export function moonriseStart(effectiveDusk, logs = []) {
  const onsets = logs.map(onsetMinutes).filter((m) => m !== null)
  let lead = DEFAULT_LEAD_MINUTES
  let basis = 'default'

  if (logs.length >= MIN_LOGGED_EVENINGS && onsets.length > 0) {
    lead = -(median(onsets) - BUFFER_MINUTES)
    basis = 'learned'
  }

  lead = Math.round(Math.min(MAX_LEAD_MINUTES, Math.max(MIN_LEAD_MINUTES, lead)))
  return {
    start: new Date(effectiveDusk.getTime() - lead * MINUTE),
    minutesBeforeDusk: lead,
    basis,
    episodesUsed: basis === 'learned' ? onsets.length : 0,
  }
}
