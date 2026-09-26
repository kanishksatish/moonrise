// Report engine: one printable weekly summary, computed only from stored logs.
//
// Covers the 7 calendar days ending on endDate (inclusive).
// endDate defaults to the most recent logged evening, or today if there are no logs.
// Cloudy evening = cloudCover >= 50%. Clear = below 50%. Unknown cloud cover is left out of both.
// Top songs = songs opened this week, ranked by score this week (calm +1, episode -1), then
// plays. Each also carries this week's plain counts (calm, restless, episode) and an
// evidenceText such as: Opened on 3 logged evenings: 2 calm, 1 restless.

import seedSongs from '../data/songs.json'
import { localDateString } from './sky.js'
import { median, onsetMinutes } from './schedule.js'
import { songScore } from './songs.js'
import { songEvidence, evidenceText } from './learning.js'

export const CLOUDY_THRESHOLD = 50
export const REPORT_DAYS = 7
export const TOP_SONG_COUNT = 5

export const DOCTOR_NOTE =
  'If evenings change suddenly, mention it to a doctor. Pain, infection, or a medication change can also cause evening agitation.'
export const SUPPORT_NOTE = 'Moonrise supports caregivers. It is not a medical treatment.'

// "25 min before dusk", "at dusk", "10 min after dusk"
export function formatOnset(minutes) {
  if (minutes === null || !Number.isFinite(minutes)) return 'unknown'
  const m = Math.round(minutes)
  if (m === 0) return 'at dusk'
  return m < 0 ? `${-m} min before dusk` : `${m} min after dusk`
}

function daysBack(endDate, days) {
  const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - days)
  return localDateString(d)
}

function skyGroup(logs) {
  return { evenings: logs.length, episodes: logs.filter((l) => l.outcome === 'episode').length }
}

function latestLogDate(logs) {
  if (logs.length === 0) return new Date()
  const latest = logs.reduce((max, l) => (l.date > max ? l.date : max), logs[0].date)
  const [y, m, d] = latest.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function weeklyReport(logs = [], { endDate = latestLogDate(logs), songs = seedSongs } = {}) {
  const to = localDateString(endDate)
  const from = daysBack(endDate, REPORT_DAYS - 1)
  const week = logs
    .filter((l) => l.date >= from && l.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const count = (outcome) => week.filter((l) => l.outcome === outcome).length
  const onsets = week.map(onsetMinutes).filter((m) => m !== null)
  const medianOnset = median(onsets)

  const withCloud = week.filter((l) => Number.isFinite(l.cloudCover))
  const cloudy = withCloud.filter((l) => l.cloudCover >= CLOUDY_THRESHOLD)
  const clear = withCloud.filter((l) => l.cloudCover < CLOUDY_THRESHOLD)

  const plays = new Map()
  for (const l of week) for (const id of l.songIds ?? []) plays.set(id, (plays.get(id) ?? 0) + 1)
  const weekEvidence = songEvidence(week)
  const topSongs = [...plays.keys()]
    .map((id) => {
      const song = songs.find((s) => s.id === id)
      if (!song) return null
      const e = weekEvidence[id] ?? { calm: 0, restless: 0, episode: 0 }
      return {
        ...song,
        score: songScore(id, week),
        plays: plays.get(id),
        calm: e.calm,
        restless: e.restless,
        episode: e.episode,
        evidenceText: evidenceText({ ...e, plays: plays.get(id) }),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.plays - a.plays || a.title.localeCompare(b.title))
    .slice(0, TOP_SONG_COUNT)

  return {
    from,
    to,
    evenings: week.length,
    counts: { calm: count('calm'), restless: count('restless'), episode: count('episode') },
    onset: {
      minutes: onsets,
      medianMinutes: medianOnset,
      text: formatOnset(medianOnset),
    },
    cloudy: skyGroup(cloudy),
    clear: skyGroup(clear),
    topSongs,
    nights: week.map((l) => ({
      date: l.date,
      outcome: l.outcome,
      onsetText: onsetMinutes(l) === null ? null : formatOnset(onsetMinutes(l)),
      cloudCover: l.cloudCover ?? null,
    })),
    doctorNote: DOCTOR_NOTE,
    supportNote: SUPPORT_NOTE,
  }
}
