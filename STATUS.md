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

## 2026-09-26 01:46 UTC — Claude — moon phase + live sky
- Done: `src/engine/moon.js` + tests (52 passing total).
- `moonPhase(date)` -> `{ phase: 0..1, illumination: 0..1, name }` (e.g. "Waxing Gibbous") for the Today card.
- `skyState(date, lat, lon)` -> `{ sunAltitude, darkness, warmth, brightness, gradient: { top, bottom } }`. For Moonrise mode: call every minute or so, use `gradient` as the background, `warmth` (0..1) for a warm overlay, `brightness` (0.5..1) for screen brightness. darkness is 0 at sun altitude >= 6 deg and 1 at <= -12 deg.
- `skyGradient(darkness)` also exported if you want to preview/animate.
- Next: memory prompts, demo week.

## 2026-09-26 01:47 UTC — Claude — memory prompts
- Done: `src/engine/prompts.js` + tests (60 passing total).
- `memoryPrompts(profile, { song })` -> string[]. profile = `{ name, birthYear, anchors: { hometown, spouse, job } }` (please save the Setup profile in this shape; job should be a role like "nurse"). Personal anchor prompts first, then era prompts (moon landing only if born before ~1962), then general ones. Passing the current `song` adds "Do you remember ... ?" first.
- `promptAt(prompts, elapsedMs)` -> the prompt to show, rotating every 3 minutes.
- Next: demo week generator.

## 2026-09-26 01:50 UTC — Claude — demo week
- Done: `src/engine/demo.js` + tests (66 passing total).
- `generateDemoWeek({ birthYear, lat, lon, endDate?, seed? })` -> 7 logs (oldest first, ending on endDate, default today), every one has `demo: true`. Seeded (default seed 1969) so the demo is repeatable. For "Load demo week": append these to stored logs and label them as demo data; filter `!log.demo` to clear them.
- Realistic shape: cloudy evenings get more episodes, onset ~35 min before dusk, two "soothing" era songs tend to play on calm nights. With London + born 1942, the start moves from 45 to 60 min before dusk and "Sweet Caroline" tops the report.
- Contract change: `weeklyReport(logs)` now defaults `endDate` to the latest logged evening (was today), so a demo week or a report printed the next morning shows the full week.
- Next: localStorage helpers.

## 2026-09-26 01:50 UTC — Claude — storage + engine complete
- Done: `src/engine/storage.js` + tests, plus a contract test (`index.test.js`) that pins the exported list. 73 tests passing, `vite build` clean.
- `loadState()` -> `{ profile, logs }` (never throws; empty state on missing/corrupt/blocked storage). `saveState(state)` -> true/false. `addLog(state, log)` (one log per date, replaces), `addDemoLogs(state, logs)`, `clearDemoLogs(state)`, `emptyState()`. All return new state objects; nothing mutates.
- Profile shape: `{ name, birthYear, lat, lon, city, anchors: { hometown, spouse, job } }`.
- **Engine is feature-complete per AGENTS.md.** Full contract is in `src/engine/index.js`. Typical Today screen flow for Codex:
  `const state = loadState()` -> `const sky = await effectiveDusk(new Date(), lat, lon)` -> `moonriseStart(sky.effectiveDusk, state.logs)` -> `moonPhase(new Date())`.
  Moonrise mode: `skyState(now, lat, lon)` each minute, `playlist(birthYear, logs)`, `memoryPrompts(profile, { song })` + `promptAt(prompts, elapsedMs)`.
  Log: `saveState(addLog(state, { date, outcome, episodeStart, effectiveDusk: sky.effectiveDusk.toISOString(), cloudCover: sky.cloudCover, songIds }))`.
- Not verified live: Open-Meteo is blocked from Claude's sandbox, so the fetch path is covered by mocked tests only. Please sanity-check it in a browser.
- Next: merge `engine` into main when you're happy; then engine side is free to help with UI wiring.

## 2026-09-26 01:52 UTC — Claude — engine merged to main
- `engine` merged into `main` (merge commit, no conflicts; includes the new package-lock.json from main). 73 tests pass on main.
- Codex: pull main to get `src/engine/index.js`. See the entries above for the contract and data shapes.

## 2026-09-26 01:58 UTC — Claude — screens wired (branch `claude-ui`, NOT merged)
- At the user's request, built all five screens on branch `claude-ui` (not `ui`, which stays free for Codex): Setup (geolocation + Open-Meteo city lookup, era songs preview), Today (sky card, countdown, 10-min heads-up alert + browser notification, moon phase), Moonrise mode (full screen, live sky gradient, stars, rising moon, warm lamp glow, song + Spotify/YouTube links, rotating read-aloud prompts, wake lock), Log (three giant buttons, optional episode time), Report (printable), Settings (load/remove demo week, edit profile, delete all). PWA manifest + icon.
- Files: `src/App.jsx`, `src/screens/*`, `src/components/*`, `src/styles/app.css`, `public/`, `index.html`.
- Verified in headless Chromium (London, 1942, demo week): start moves 6:04 -> 5:49 PM after demo load, alert fires, report prints, episode log stores songs played, state survives reload. No page errors (only blocked Open-Meteo requests in Claude's sandbox).
- Small engine change: `loadState` now keeps extra keys (the UI stores `tonight: { date, songIds }`). 74 tests pass.
- Ownership: the proposed bridge gives UI to Codex. Waiting on the user to decide whether Codex builds on `claude-ui` or starts fresh.

## 2026-09-26 02:06 UTC — Claude — handover: Codex owns `claude-ui`
- User decision: Codex takes over branch `claude-ui` (all screens). Claude will not push to it again.
- Claude stays on `engine` (engine + integrations). Any engine interface change will be raised in the coordination issue before it is made.
## 2026-09-26 02:14 UTC — Claude — weather timeout (engine branch)
- Fix: `effectiveDusk` now gives up on Open-Meteo after 8 s (request or body) and returns the offline SunCalc sunset, so bad wifi can't leave Today stuck on "Checking the sky…". The request is aborted, timer cleaned up. 3 new tests (76 total).
- Interface: backward compatible. Optional `{ timeoutMs }` option added; UI callers need no change.

## 2026-09-26 02:15 UTC — Claude — weather cache + song fact-check (engine branch)
- `effectiveDusk`: if a refresh fails, reuses this session's last good weather for the same day and place (`source: 'open-meteo', cached: true`) instead of jumping back to plain sunset mid-evening. Additive field only. 78 tests pass.
- songs.json fact-checked by web search: 44/47 confirmed. Fixed Rock Around the Clock 1955 -> 1954 (released May 1954, charted 1955) and Paper Doll 1943 -> 1942 (released 1942, charted 1943). Their ids changed to `rock-around-the-clock-1954` and `paper-doll-1942`; no code references song ids, and old demo logs just stop matching those two songs.
- Kept "As Time Goes By" as Dooley Wilson 1942 (the Casablanca performance people remember; his own record came later). Search links still find it.
- Pending Codex OK: `eveningDate` / `episodeStartFromTime` for after-midnight logging (built locally, not pushed).

## 2026-09-26 02:17 UTC — Claude — after-midnight logging helpers (approved by Codex in issue #1)
- New in `src/engine/evening.js`, exported from `index.js` (existing exports unchanged):
  - `eveningDate(now = new Date()) -> Date | null`: new Date at device-local noon of the evening `now` belongs to; before 04:00 = previous calendar day. Calendar arithmetic (DST/month/year safe), input not mutated. null for an invalid date.
  - `episodeStartFromTime(evening, 'HH:MM') -> string | null`: ISO timestamp; 00:00-03:59 = the next calendar day, otherwise the evening's own day. **null** for empty/malformed/out-of-range time, invalid evening, or a local time skipped by a DST jump.
  - `localDateString(date) -> 'YYYY-MM-DD'` now exported.
- Use `eveningDate` only for evening grouping (log date, `effectiveDusk(eveningDate(), ...)`, `tonight.date`); countdowns/animation stay on `now`.
- Tests: 23:59/00:00/03:59/04:00, month + year rollover, Chicago DST both ways (test file runs with TZ=America/Chicago), null cases, no mutation, and the 00:30-log / 23:30-onset scenario keeping the previous evening's date and dusk. 93 tests pass; also pass under TZ=Asia/Kolkata and Pacific/Auckland.

## 2026-09-26 02:17 UTC — Claude — song ids restored (per Codex review)
- Correction to the song fact-check entry above: ids are **not** renamed. `rock-around-the-clock-1955` (year 1954) and `paper-doll-1943` (year 1942) keep their shipped ids so saved logs keep their scores and report entries. Song ids are opaque and stable; only `year` changes. Documented in songs.js and pinned by tests. 95 tests pass.

## 2026-09-26 02:28 UTC — Claude — findCity (approved by Codex in issue #1)
- New export `findCity(name, { fetchFn?, timeoutMs? }) -> Promise<{ lat, lon, city } | null>` (Open-Meteo geocoding).
  - Resolves **null** only for a blank name or a successful response with no matches.
  - **Rejects** on HTTP error, network failure, 8 s timeout (request aborted), or a malformed response/result (non-finite coordinates, missing place name).
  - UI (Codex): Setup must handle null ("couldn't find that city") separately from a rejection ("couldn't check right now"); the current local findCity throws on no-match, so it's not a drop-in swap.
- Internal: new `net.js` `fetchJson` timeout helper now shared by effectiveDusk and findCity (effectiveDusk behaviour unchanged).
- Deferred per Codex: duskForecast (not built into the engine).
- 106 tests pass.

## 2026-09-26 02:42 UTC — Codex — midnight and Setup integration
- Integrated main into the UI review branch. App/Today/Log group evenings before 04:00 consistently; sky responses retain the captured date/location, and saves refuse stale sky or future/invalid onset times. Same-evening song IDs survive late logs. Demo weeks end before the current evening.
- Setup uses engine findCity, distinguishing no match from service errors; concurrent lookups are disabled. Added an accessible city label and explicit outcome button names. Storage failures are surfaced to the caregiver.
- Nine new focused UI/helper tests pass, including the 00:30/23:30 flow and 04:00 refresh. Full suite/build and browser/demo pass follow PWA integration.
