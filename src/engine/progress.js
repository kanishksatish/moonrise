// Caregiver progress milestones: light, process-only gamification.
//
// Milestones mark steps in using Moonrise (logging evenings, playing songs, the start time
// becoming based on your own logs). They never reward a calm evening or a particular song,
// there are no streaks to lose, nothing scores the person with dementia, and an episode
// evening counts exactly like any other logged evening.
// `usesDemo` flags any milestone whose shown values depend on demo evenings; realProgress()
// gives the same milestones from real evenings only.

import { moonriseStart } from './schedule.js'

const WEEK = 7

function evaluate(logs) {
  const dates = new Set(logs.map((l) => l.date))
  const songsOpened = logs.some((l) => (l.songIds ?? []).length > 0)
  const start = moonriseStart(new Date(0), logs)
  const timed = start.episodesUsed

  return [
    {
      id: 'first-evening',
      title: 'First evening logged',
      detail: 'Every logged evening counts, whatever kind of evening it was.',
      current: Math.min(dates.size, 1),
      target: 1,
    },
    {
      id: 'first-song',
      title: 'First song played in the app',
      detail: 'Era songs that play in Moonrise are noted with that evening.',
      current: songsOpened ? 1 : 0,
      target: 1,
    },
    {
      id: 'start-from-logs',
      title: 'Start time based on your logs',
      detail:
        start.basis === 'learned'
          ? `The suggested start now uses ${timed} timed ${timed === 1 ? 'episode' : 'episodes'} as well as the sky.`
          : 'Happens after 3 logged evenings, including one episode with a start time.',
      current: start.basis === 'learned' ? 3 : Math.min(dates.size, 2),
      target: 3,
    },
    {
      id: 'week',
      title: 'A week of evenings recorded',
      detail: 'Enough for a weekly summary to share with family or a doctor.',
      current: Math.min(dates.size, WEEK),
      target: WEEK,
    },
  ].map((m) => ({ ...m, done: m.current >= m.target }))
}

// Returns milestones in a fixed order: [{ id, title, detail, done, current, target, usesDemo }].
// usesDemo is true whenever demo evenings change anything shown for that milestone (its
// progress count, its detail text or whether it's done), compared with real evenings alone.
export function progress(logs = []) {
  const real = new Map(evaluate(logs.filter((l) => !l.demo)).map((m) => [m.id, m]))
  return evaluate(logs).map((m) => {
    const r = real.get(m.id)
    return { ...m, usesDemo: m.current !== r.current || m.detail !== r.detail || m.done !== r.done }
  })
}

// The same milestones from real evenings only (what to show if demo data should be ignored).
export function realProgress(logs = []) {
  return progress(logs.filter((l) => !l.demo))
}
