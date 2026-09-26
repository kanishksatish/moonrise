// Caregiver progress milestones: light gamification that only ever reflects real learning.
//
// Each milestone is computed from the logged evenings; nothing is awarded for time spent,
// there are no streaks to lose, no score for the person with dementia, and no outcome counts
// as failure (a logged episode moves learning forward exactly like a calm evening).
// `usesDemo` is true when a milestone is only reached because of demo evenings, so the UI can
// label it.

import { moonriseStart } from './schedule.js'
import { songStats } from './learning.js'
import { findSong } from './songs.js'

const WEEK = 7

function songEvidence(id, st) {
  const title = findSong(id)?.title ?? 'A song'
  const parts = [`${st.calm} calm`]
  if (st.restless) parts.push(`${st.restless} restless`)
  if (st.episode) parts.push(`${st.episode} with an episode`)
  return `${title}: opened on ${st.plays} evenings (${parts.join(', ')}). Calmer than usual so far; keep noticing.`
}

function evaluate(logs) {
  const dates = new Set(logs.map((l) => l.date))
  const songsTried = new Set(logs.flatMap((l) => l.songIds ?? []))
  const start = moonriseStart(new Date(0), logs)
  const stats = songStats(logs)
  const promising = Object.entries(stats)
    .filter(([, s]) => s.status === 'promising')
    .sort((a, b) => b[1].calmRate - a[1].calmRate)
    .map(([id]) => id)
  const timedEpisodes = start.episodesUsed

  return [
    {
      id: 'first-evening',
      title: 'First evening logged',
      detail: 'Every logged evening helps Moonrise learn, whatever kind of evening it was.',
      current: Math.min(dates.size, 1),
      target: 1,
    },
    {
      id: 'first-song',
      title: 'First song tried',
      detail: 'Songs you open during Moonrise are linked to how the evening went.',
      current: Math.min(songsTried.size, 1),
      target: 1,
    },
    {
      id: 'start-adapting',
      title: 'Start time adapts to your evenings',
      detail:
        start.basis === 'learned'
          ? `Now based on ${timedEpisodes} timed episode${timedEpisodes === 1 ? '' : 's'} as well as the sky.`
          : 'Needs 3 logged evenings, including one episode with a start time.',
      current: start.basis === 'learned' ? 3 : Math.min(dates.size, 2),
      target: 3,
    },
    {
      // Worded as "worth trying again", not "helps": songs share each evening's outcome, and
      // in simulation most flagged songs were not the truly helpful ones (METHODOLOGY.md).
      id: 'promising-song',
      title: 'A song worth trying again',
      detail: promising.length ? songEvidence(promising[0], stats[promising[0]]) : 'Found when a song has been opened on enough calmer-than-usual evenings.',
      current: promising.length ? 1 : 0,
      target: 1,
    },
    {
      id: 'week',
      title: 'A week of evenings',
      detail: 'Enough for a useful weekly report to share with family or a doctor.',
      current: Math.min(dates.size, WEEK),
      target: WEEK,
    },
    {
      id: 'start-confident',
      title: 'Start time is well established',
      detail:
        start.confidence === 'high'
          ? `The suggested start is steady to within about ${start.halfWidthMinutes} minutes.`
          : 'Reached when the logged episode times agree closely.',
      current: start.confidence === 'high' ? 1 : 0,
      target: 1,
    },
  ].map((m) => ({ ...m, done: m.current >= m.target }))
}

// Returns milestones in a fixed order: [{ id, title, detail, done, current, target, usesDemo }].
export function progress(logs = []) {
  const all = evaluate(logs)
  const realDone = new Map(evaluate(logs.filter((l) => !l.demo)).map((m) => [m.id, m.done]))
  return all.map((m) => ({ ...m, usesDemo: m.done && !realDone.get(m.id) }))
}
