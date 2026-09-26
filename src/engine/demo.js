// Demo data: a realistic week of evening logs from a seeded random function,
// so the learning and the report can be shown live. Every log has demo: true;
// the UI must label it clearly as demo data.
//
// How the week is shaped (nothing here is a fixed result; it all flows through the real engine):
//   - Cloud cover: ~45% of evenings cloudy (60..100%), the rest clear (0..35%).
//   - Effective dusk: real SunCalc sunset for that date and place, shifted by cloud cover
//     with the same formula as effectiveDusk().
//   - Outcome: episodes are more likely on cloudy evenings (60%) than clear ones (20%).
//     At least 2 episodes per week so the schedule has something to learn from.
//   - Episode onset: about 35 minutes before dusk, +/- 15 minutes.
//   - Songs: 3 era songs per evening. Two "soothing" songs tend to play on calm evenings.

import { getTimes } from 'suncalc'
import { cloudShiftMinutes, localDateString } from './sky.js'
import { eraSongs } from './songs.js'
import { seededRandom } from './random.js'

const MINUTE = 60 * 1000
export const DEMO_SEED = 1969
export const DEMO_DAYS = 7

function pick(list, random) {
  return list[Math.floor(random() * list.length)]
}

function pickDistinct(list, count, random, exclude = []) {
  const pool = list.filter((s) => !exclude.includes(s))
  const out = []
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return out
}

// Returns DEMO_DAYS logs for the evenings ending on endDate (inclusive), oldest first.
export function generateDemoWeek({ birthYear, lat, lon, endDate = new Date(), seed = DEMO_SEED }) {
  const random = seededRandom(seed)
  const songIds = eraSongs(birthYear).map((s) => s.id)
  const soothing = pickDistinct(songIds, 2, random)

  const logs = []
  for (let i = DEMO_DAYS - 1; i >= 0; i--) {
    const day = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - i, 12)
    const cloudy = random() < 0.45
    const cloudCover = Math.round(cloudy ? 60 + random() * 40 : random() * 35)
    const sunset = getTimes(day, lat, lon).sunset
    const dusk = new Date(sunset.getTime() - cloudShiftMinutes(cloudCover) * MINUTE)

    const roll = random()
    const pEpisode = cloudy ? 0.6 : 0.2
    const outcome = roll < pEpisode ? 'episode' : roll < pEpisode + 0.25 ? 'restless' : 'calm'

    logs.push({ date: localDateString(day), cloudCover, effectiveDusk: dusk.toISOString(), outcome })
  }

  // Guarantee at least 2 episodes: turn the cloudiest non-episode evenings into episodes.
  const byCloud = logs.filter((l) => l.outcome !== 'episode').sort((a, b) => b.cloudCover - a.cloudCover)
  while (logs.filter((l) => l.outcome === 'episode').length < 2 && byCloud.length) {
    byCloud.shift().outcome = 'episode'
  }

  return logs.map((l) => {
    const onset = -35 + Math.round((random() - 0.5) * 30)
    const episodeStart =
      l.outcome === 'episode' ? new Date(new Date(l.effectiveDusk).getTime() + onset * MINUTE).toISOString() : null

    let played
    if (l.outcome === 'episode') {
      played = pickDistinct(songIds, 3, random, soothing)
    } else {
      const first = pick(soothing, random)
      played = [first, ...pickDistinct(songIds, 2, random, [first])]
    }
    return { ...l, episodeStart, songIds: played, demo: true }
  })
}
