// Songs engine: era-matched music from the reminiscence bump, ranked by what has helped.
//
// eraYears(birthYear) = birthYear + 10 to birthYear + 30 (inclusive).
// songScore: starts at 0, +1 for each "calm" evening it played on, -1 for each "episode"
// evening. "restless" evenings do not change the score. (The simple AGENTS.md count, kept
// for display and the report.)
// playlist: era songs sorted by score, highest first. Ties are shuffled randomly.
// (We tested ranking by a Bayesian calm rate instead; in simulation the simple score found
// helpful songs as well or better, so it stays. See METHODOLOGY.md.) Each song also carries
// its evidence (plays, calmRate, status) from songStats so the UI can show how sure we are.
//
// Song ids are opaque and must never change once shipped: saved logs store them, and
// scores and the report match them exactly. Fix a wrong year in `year` only; the year
// inside an id is just part of the name (e.g. rock-around-the-clock-1955 has year 1954).

import seedSongs from '../data/songs.json'
import { songStats, untriedSong } from './learning.js'

export const ERA_START_AGE = 10
export const ERA_END_AGE = 30

export function eraYears(birthYear) {
  return { from: birthYear + ERA_START_AGE, to: birthYear + ERA_END_AGE }
}

export function eraSongs(birthYear, songs = seedSongs) {
  const { from, to } = eraYears(birthYear)
  return songs.filter((s) => s.year >= from && s.year <= to)
}

const OUTCOME_POINTS = { calm: 1, restless: 0, episode: -1 }

export function songScore(songId, logs = []) {
  let score = 0
  for (const log of logs) {
    if ((log.songIds ?? []).includes(songId)) score += OUTCOME_POINTS[log.outcome] ?? 0
  }
  return score
}

// Returns era songs as [{ ...song, score, calmRate, status, plays }], best first.
// random is injectable for tests (it only orders songs whose calm rate is tied).
export function playlist(birthYear, logs = [], { songs = seedSongs, random = Math.random } = {}) {
  const stats = songStats(logs)
  const fresh = untriedSong(logs)
  const scored = eraSongs(birthYear, songs).map((s) => {
    const st = stats[s.id] ?? fresh
    return { ...s, score: songScore(s.id, logs), calmRate: st.calmRate, status: st.status, plays: st.plays }
  })
  // Shuffle first (Fisher-Yates), then a stable sort by score keeps ties in random order.
  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[scored[i], scored[j]] = [scored[j], scored[i]]
  }
  return scored.sort((a, b) => b.score - a.score)
}

export function findSong(songId, songs = seedSongs) {
  return songs.find((s) => s.id === songId) ?? null
}

// We do not host audio. Songs open as search links.
export function spotifySearchUrl(song) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`
}

export function youtubeSearchUrl(song) {
  const q = encodeURIComponent(`${song.title} ${song.artist} ${song.year}`)
  return `https://www.youtube.com/results?search_query=${q}`
}
