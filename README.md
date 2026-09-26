# Moonrise

**A calm evening routine for people with dementia, timed to the real sky.**

Many people living with dementia become more confused or agitated as daylight fades, often
called *sundowning*. Moonrise helps family caregivers get ahead of it. It works out when
it will actually get dark today, reminds the caregiver before then, and runs a gentle
full-screen routine: warm light that brightens as the sky darkens, music from the person's
youth, and simple memory prompts. After each evening, one tap records how it went, and
Moonrise learns the best start time and which songs help.

> Moonrise supports caregivers. It is **not** a medical treatment and does not diagnose,
> treat or prevent anything. Sudden changes in evening behaviour can have medical causes
> (pain, infection, medication), so mention them to a doctor.

No hardware, no account, no backend. It is a web app (PWA) that runs on any tablet or phone.

## How it works

| Step | What Moonrise does |
| --- | --- |
| Setup | Name, birth year, location (browser location or city search) and up to three optional memory anchors: hometown, spouse, job. |
| Today | Shows today's **effective dusk**, the **Moonrise start time**, the moon phase and a countdown. A heads-up alert appears 10 minutes before the start. |
| Moonrise mode | A full-screen sky that follows the real sky (blue → dusk → night), a slowly rising moon, warm light that increases as it gets dark, a song from the person's era with a play link, and one memory prompt at a time for the caregiver to read aloud. |
| Log | Three big buttons: **Calm**, **Restless**, **Episode**, plus an optional "episode started at" time. |
| Report | A one-page printable weekly summary to share with family or a doctor. |

### The formulas

All results are computed from real data (the sky, the weather and the caregiver's own logs).
Nothing is hardcoded.

- **Effective dusk.** Sunset from [Open-Meteo](https://open-meteo.com/) (free, no key),
  moved earlier by the cloud cover over the 2 hours before sunset:
  `shift = average cloud cover % / 100 × 30 minutes`. A fully overcast evening gets dark
  30 minutes sooner. If the weather service can't be reached within 8 seconds, Moonrise
  uses the astronomical sunset ([SunCalc](https://github.com/mourner/suncalc)) with no shift.
- **Start time.** 45 minutes before effective dusk by default. After 3+ logged evenings
  with timed episodes, it's the median time episodes began (relative to dusk) minus a
  20-minute buffer, kept between 90 and 15 minutes before dusk.
- **Era music.** Songs from the person's ages 10 to 30 (the "reminiscence bump").
  Each song scores +1 when it played on a calm evening and −1 on an episode evening. The
  playlist plays the best-scoring songs first, in random order among ties. Songs open as
  Spotify or YouTube searches; Moonrise doesn't host audio.
- **Evenings after midnight.** Anything logged before 4 AM counts toward the previous
  evening, so late-night logs land on the right day.

### Demo data

Settings has a **Load demo week** button. It generates a realistic week of evening logs
from a seeded random function, so the learning and the report can be shown live. Demo
logs are clearly labelled and can be removed in one tap. Real evenings are never replaced.

## Privacy

Everything stays on the device, in the browser's local storage. There is no server and
no login. The only network calls are the weather and city lookups (Open-Meteo, which
receives coordinates or a city name) and the song search links the caregiver chooses
to open.

## Run it

Requires Node.js 22.12 or newer (needed by Vite 8 and Vitest 5).

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests (Vitest)
npm run build    # production build in dist/
```

## Project layout

```
src/engine/     Pure logic with unit tests: sky, schedule, songs, report, moon, prompts,
                demo data, storage, evening dates, city lookup. index.js is the
                contract the UI imports from.
src/data/       songs.json: era songs (title, artist, year), years web-verified.
src/screens/    Setup, Today, Moonrise mode, Log, Report, Settings.
src/components/ Shared UI pieces.
src/styles/     Plain CSS: 20px+ text, 48px+ tap targets, high contrast, dark-room friendly.
```

`AGENTS.md` is the project brief and `STATUS.md` is the running build log.

## Built with

Vite, React, plain CSS, SunCalc, the Open-Meteo forecast and geocoding APIs, and Vitest.
It was built overnight at a hackathon ("Fly me to the moon") by two humans working with two AI coding
agents (Claude Code on the engine, Codex on the UI) coordinating through a GitHub issue.
