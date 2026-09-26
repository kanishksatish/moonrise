// How sure is Moonrise about what it has learned from the family's own logged evenings?
//
// The learning rules themselves are the simple ones in AGENTS.md (song score +1/-1, start =
// median onset - 20 min): in our simulation study they beat the Bayesian alternatives we
// tried (see METHODOLOGY.md). What this file adds is honest uncertainty on top of them:
// how much evidence a song has, and a calibrated range for the start time.
// Everything here is deterministic: the same logs always give the same numbers.

// ---- How calm an evening was, as a number ----------------------------------------------
// calm = 1, restless = 0.5, episode = 0. Restless counts as half: not the evening we hoped
// for, but not an episode either.
export const OUTCOME_VALUE = { calm: 1, restless: 0.5, episode: 0 }

// ---- Family calm rate ------------------------------------------------------------------
// The share of logged evenings that were calm (restless counting half), with one pseudo-
// evening at 0.5 so a family with no logs starts at an honest "50/50".
export function familyCalmRate(logs = []) {
  let sum = 0.5
  let n = 1
  for (const log of logs) {
    if (log.outcome in OUTCOME_VALUE) {
      sum += OUTCOME_VALUE[log.outcome]
      n += 1
    }
  }
  return sum / n
}

// ---- Songs: Beta-Bernoulli estimate of "chance of a calm evening when this song is opened"
// Prior: Beta(k * p0, k * (1 - p0)) where p0 is the family calm rate and k = SONG_PRIOR_STRENGTH,
// i.e. every song starts out "like an average evening for this family", worth 4 evenings of
// evidence. Each evening the song's link was opened adds its outcome value.
// Posterior mean = (k * p0 + sum of outcome values) / (k + plays).
// Range: mean +/- 1.645 posterior standard deviations (about a 90% interval), kept in [0, 1].
export const SONG_PRIOR_STRENGTH = 4
const Z90 = 1.645

export function songStats(logs = []) {
  const p0 = familyCalmRate(logs)
  const tally = new Map()
  for (const log of logs) {
    if (!(log.outcome in OUTCOME_VALUE)) continue
    for (const id of new Set(log.songIds ?? [])) {
      const t = tally.get(id) ?? { plays: 0, calm: 0, restless: 0, episode: 0, value: 0 }
      t.plays += 1
      t[log.outcome] += 1
      t.value += OUTCOME_VALUE[log.outcome]
      tally.set(id, t)
    }
  }
  const out = {}
  for (const [id, t] of tally) out[id] = describeSong(t, p0)
  return out
}

// Stats for a song with no plays (what songStats implies for anything not listed).
export function untriedSong(logs = []) {
  return describeSong({ plays: 0, calm: 0, restless: 0, episode: 0, value: 0 }, familyCalmRate(logs))
}

function describeSong(t, p0) {
  const a = SONG_PRIOR_STRENGTH * p0 + t.value
  const b = SONG_PRIOR_STRENGTH * (1 - p0) + (t.plays - t.value)
  const mean = a / (a + b)
  const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))
  const low = Math.max(0, mean - Z90 * sd)
  const high = Math.min(1, mean + Z90 * sd)
  // "promising" = the whole range sits above the family's usual calm rate. In simulation
  // only ~40% of songs flagged this way were truly helpful (songs share each evening's
  // outcome), so the UI must present it as "worth trying again", never "this song helps".
  let status = 'learning'
  if (t.plays === 0) status = 'untried'
  else if (low > p0) status = 'promising'
  else if (high < p0) status = 'unpromising'
  return {
    plays: t.plays,
    calm: t.calm,
    restless: t.restless,
    episode: t.episode,
    // The original AGENTS.md count: +1 calm, -1 episode, 0 restless.
    score: t.calm - t.episode,
    calmRate: round3(mean),
    low: round3(low),
    high: round3(high),
    familyRate: round3(p0),
    status,
  }
}

// ---- Start time: calibrated range around the median rule ------------------------------
// The start time itself is the AGENTS.md rule: target lead = median of (-(onset) + 20).
// The range is median +/- Z * 1.2533 * sd / sqrt(n), where 1.2533 converts a standard
// deviation into the standard error of a median, and sd pools the observed spread with a
// prior spread of START_PRIOR_SD minutes worth START_PRIOR_STRENGTH evening(s), so one or
// two episodes can't produce a falsely narrow range. Z = 1.1 was chosen by simulation to
// contain the ideal start about 80% of the time (METHODOLOGY.md, study 2).
export const START_PRIOR_STRENGTH = 1
export const START_PRIOR_SD = 20
export const START_RANGE_Z = 1.1
const MEDIAN_SE = 1.2533

export function startRange(targets) {
  const n = targets.length
  if (n === 0) return { median: null, halfWidth: START_RANGE_Z * START_PRIOR_SD, n: 0 }
  const sorted = [...targets].sort((x, y) => x - y)
  const mid = Math.floor(n / 2)
  const med = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const ss = targets.reduce((sum, x) => sum + (x - med) ** 2, 0)
  const sd = Math.sqrt((START_PRIOR_STRENGTH * START_PRIOR_SD ** 2 + ss) / (START_PRIOR_STRENGTH + n))
  return { median: med, halfWidth: (START_RANGE_Z * MEDIAN_SE * sd) / Math.sqrt(n), n }
}

function round3(x) {
  return Math.round(x * 1000) / 1000
}
