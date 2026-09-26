# Status

Append entries: time, who (Claude or Codex), what finished, what is next, notes for the other side.

## Scaffold
- Vite + React app with suncalc and vitest. Run npm install after cloning.
- AGENTS.md is the brief. CLAUDE.md imports it.
- Next: Claude on `engine` branch, Codex on `ui` branch.

## 2026-09-26 01:39 UTC — Claude — effectiveDusk
- Done: `src/engine/sky.js` with `effectiveDusk(date, lat, lon)` + 16 unit tests in `src/engine/__tests__/sky.test.js` (all passing).
- Formula: cloudCover = average hourly cloud_cover over the 2h before sunset; shift = round(cloudCover / 100 * 30) min; effectiveDusk = sunset - shift.
- Contract (new `src/engine/index.js`): `effectiveDusk(date, lat, lon)` is **async** and resolves to
  `{ sunset: Date, cloudCover: number|null, shiftMinutes: number, effectiveDusk: Date, source: 'open-meteo'|'offline' }`.
  If Open-Meteo is unreachable it falls back to SunCalc sunset with no cloud shift and `source: 'offline'` (UI may want to show "offline, no cloud data").
  Also exported: `computeEffectiveDusk(sunset, hourly)`, `cloudShiftMinutes(percent)`.
- Note: suncalc 2.x is ESM with named exports: `import { getTimes } from 'suncalc'` (no default export).
- Next: `moonriseStart(effectiveDusk, logs)`.

## 2026-09-26 01:44 UTC — Claude — moonriseStart
- Done: `src/engine/schedule.js` with `moonriseStart(effectiveDusk, logs)` + tests (26 passing total).
- Returns `{ start: Date, minutesBeforeDusk, basis: 'default'|'learned', episodesUsed }`. Default 45 min before dusk; with 3+ logged evenings and at least one timed episode, uses median(onset - dusk) - 20 min, clamped to 15..90 min before dusk.
- **Log shape (UI please save logs like this):**
  `{ date: 'YYYY-MM-DD', outcome: 'calm'|'restless'|'episode', episodeStart: ISO|null, effectiveDusk: ISO, cloudCover: number|null, songIds: string[] }`.
  Store that evening's `effectiveDusk` and `cloudCover` from `effectiveDusk()`, and the ids of songs played in Moonrise mode.
- Contract: added `moonriseStart`, `onsetMinutes` to `src/engine/index.js`.
- Next: songs (songs.json, eraYears, songScore, playlist).

## 2026-09-26 01:44 UTC — Claude — songs
- Done: `src/data/songs.json` (47 real songs, 1941 to 1978, each `{ id, title, artist, year }`), `src/engine/songs.js`, `src/engine/random.js` (seeded random), tests (37 passing total).
- `eraYears(birthYear)` -> `{ from, to }` (age 10 to 30). `eraSongs(birthYear)` filters songs.json. Born 1942 -> 1952..1972.
- `songScore(songId, logs)`: +1 calm, -1 episode, 0 restless. `playlist(birthYear, logs)` -> era songs with `score`, best first, ties shuffled.
- `spotifySearchUrl(song)`, `youtubeSearchUrl(song)`, `findSong(id)` for the play link and report.
- Contract: added the above to `src/engine/index.js`.
- Next: weeklyReport.

## 2026-09-26 01:45 UTC — Claude — weeklyReport
- Done: `src/engine/report.js` + tests (45 passing total).
- `weeklyReport(logs, { endDate })` -> `{ from, to, evenings, counts: {calm, restless, episode}, onset: {minutes, medianMinutes, text}, cloudy: {evenings, episodes}, clear: {evenings, episodes}, topSongs: [{...song, score, plays}], nights: [{date, outcome, onsetText, cloudCover}], doctorNote, supportNote }`.
- 7 days ending on endDate (default today). Cloudy = cloudCover >= 50%. Please render `doctorNote` and `supportNote` on the printed page.
- `formatOnset(minutes)` -> "25 min before dusk" / "at dusk" / "10 min after dusk".
- Next: moon + sky darkness for Moonrise mode, memory prompts, demo week.
