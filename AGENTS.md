# Moonrise

Hackathon theme: "Fly me to the moon." Build overnight, demo in the morning.

## What we are building
Moonrise is a zero-hardware web app (PWA, runs on any tablet or phone) that helps family caregivers make an evening routine for people with dementia. It schedules the routine against the real sky: it computes today's effective dusk from local sunset and cloud cover, reminds the caregiver before it, then runs "Moonrise mode": warm screen light that brightens as the sky darkens, a licensed listening library or the caregiver's own music file, and simple memory prompts. The caregiver logs how the evening went with one tap. The app adjusts its suggested start using those logs and summarizes recorded music activity without claiming that a song caused an outcome.

It is caregiver support, not a medical treatment. Never claim it treats or prevents anything.

## Users
- Primary: an exhausted family caregiver, often older, not tech-savvy. Every screen must be usable in 3 seconds with one hand.
- Secondary: the person with dementia, who only ever sees Moonrise mode. No text they need to read, no buttons they need to press.

## Stack and constraints
- Single-page web app. Vite + React + plain CSS. No hosted backend or login. The user authorized an optional laptop-only OpenAI gateway in `local-ai/`; bind it only to 127.0.0.1, keep keys in server memory, retain the strict request/profile limits and caregiver approval gate, and never deploy it as a public proxy. The hosted Anthropic path stays unchanged.
- State in localStorage, wrapped in try/catch.
- Weather and sun: Open-Meteo API (free, no key). Daily sunset, hourly cloud_cover for the user's lat/lon.
- Moon position and phase: SunCalc (npm).
- Music: the user authorized bundled licensed audio. `src/assets/audio/catalog.json` identifies the included MP3s and their recording credits/licenses; the visible picker uses native in-app playback and reports offline availability per recording. The app and piano install first; additional recordings download separately, and their failures must not block core activation. Offline seeking requires that track's completed download. This shared collection is not era-matched. Personal files stay on the device and are not assigned catalog IDs. Existing `src/data/songs.json` IDs retain their meaning; an optional YouTube recording is offered only when verified for playback. Do not substitute search links, infer rights from an old composition, or reassign historical IDs.
- Never hardcode demo results. Everything shown is computed from the stored data.
- Accessibility: minimum 20px body text, 48px tap targets, high contrast, works in dark rooms.

## Core logic (engine)
1. `effectiveDusk(date, lat, lon)`: sunset time shifted earlier by cloud cover in the 2 hours before sunset. Start simple: shift = cloud_cover_percent / 100 * 30 minutes. Document the formula in code comments.
2. `moonriseStart(effectiveDusk, logs)`: default start = effective dusk minus 45 minutes. After 3+ logged evenings, use the median of (episode onset minus effective dusk) across logged episodes, minus a 20-minute buffer. Clamp to between 90 and 15 minutes before effective dusk.
3. `eraYears(birthYear)`: birthYear + 10 to birthYear + 30. Filter songs.json to this window.
4. `songScore`: each song starts at 0. +1 when it played on a "calm" evening, -1 on an "episode" evening. Playlist sorts by score, ties random.
5. `weeklyReport(logs)`: one printable page. Episode count, onset time relative to dusk, cloudy vs clear evenings, top 5 songs. Include a line telling the caregiver to mention sudden changes to a doctor, since pain, infection, or medication can cause evening agitation too.

## Screens (UI)
1. Setup (first run only): name, birth year, location (browser geolocation with manual city fallback), 3 optional personal anchors (hometown, spouse, job).
2. Today: big sky card showing effective dusk, Moonrise start time, moon phase, and one big "Start Moonrise now" button. A countdown to start.
3. Moonrise mode: full screen. Background is a sky gradient that tracks the real sky (blue to dusk to night). A moon slowly rises over the session. Screen warmth and brightness increase as the real sky darkens. Show the real selected recording, an accessible library picker, and native playback controls. Only a playback event may add that recording's own ID to the evening. One memory prompt at a time is read aloud by the caregiver; prompts use personal anchors and age-appropriate context independently of the music selection. Never mention an unrelated era song while another recording plays.
4. Log: three giant buttons (Calm, Restless, Episode) plus optional "Episode started at" time picker.
5. Report: printable weekly summary.

## Ownership (to avoid merge conflicts)
- Engine (Claude side): `src/engine/` (sky, schedule, songs, report) and `src/data/`. Pure functions with unit tests in `src/engine/__tests__/`.
- UI (Codex side): `src/screens/`, `src/components/`, `src/styles/`. Imports only the functions exported from `src/engine/index.js`.
- Shared contract lives in `src/engine/index.js`. Change it only after noting the change in STATUS.md.

## Working rules
- Pull before starting any task. Small commits. Merge to main often.
- After each task, append to STATUS.md: what you finished, what is next, anything the other side needs to know.
- Keep code simple and readable. No clever abstractions.
- Demo data: add a "Load demo week" button in settings that generates a realistic week of logs from a seeded random function, so the learning and report can be shown live. Label it clearly as demo data.

## Demo script (3 minutes)
1. The problem in one sentence, one stat.
2. Setup for a person born in 1942. Explain birth year informs conversation context; show the included library and play an actual recording.
3. Today screen: cloudy day pulls dusk earlier. Alert fires.
4. Moonrise mode running full screen, moon rising.
5. Load demo week, show start time shifting and the weekly report.
6. Close: "Every evening, we fly them back to the moon."
