# Moonrise

**A calm evening routine for people with dementia, timed to the real sky.**

Many people living with dementia become more confused or agitated as daylight fades, often
called *sundowning*. Moonrise helps family caregivers plan ahead for it. It **estimates** this
evening's dusk from local sunset and cloud cover, suggests a time to start a calming routine,
and reminds the caregiver while the app is open. The routine is gentle and full-screen:
warm light that brightens as the sky darkens, music from the person's youth, and simple
memory prompts. After each evening, one tap records how it went. Moonrise then adjusts its
suggested start time from the logged evenings, and summarizes the songs opened during them.
Song rankings reflect associations in the caregiver's own logs, not proof a song helps.

> Moonrise supports caregivers. It is **not** a medical treatment and does not diagnose,
> treat or prevent anything. Sudden changes in evening behaviour can have medical causes
> (pain, infection, medication), so mention them to a doctor.

No hardware, no account, no backend. It is a web app (PWA) that runs on any tablet or phone.

## How it works

| Step | What Moonrise does |
| --- | --- |
| Setup | Name, birth year, location (browser location or city search) and up to three optional memory anchors: hometown, spouse, job. |
| Today | The suggested **start time** with a countdown, the moon phase, and an **estimated dusk** (tap to see sunset and cloud details). A heads-up appears 10 minutes before the start while the app is open. A small "constellation" shows one star per logged evening in the last week. Every outcome counts the same, and there are no streaks or scores. |
| Moonrise mode | A full-screen sky that follows the real sky (blue → dusk → night), a slowly rising moon, warm light that increases as it gets dark, a song from the person's era with a play link, and one memory prompt at a time for the caregiver to read aloud. |
| Log | Three big buttons: **Calm**, **Restless**, **Episode**, plus an optional "episode started at" time. |
| Report | A one-page printable weekly summary to share with family or a doctor, including "songs from your evenings" (logged associations, not proven benefit). |

### The formulas

These are simple, transparent **prototype rules**, not measurements or clinical predictions.
Every result is computed from real inputs (the sun's position, the weather forecast and the
caregiver's own logs). Formula constants and built-in prompt templates are documented below;
the optional demo week is explicitly labelled.

- **Estimated dusk.** Sunset from [Open-Meteo](https://open-meteo.com/) (free, no key),
  moved earlier by the forecast cloud cover over the 2 hours before sunset:
  `shift = average cloud cover % / 100 × 30 minutes`. It's a prototype rule of thumb
  (overcast evenings get dim sooner), not a measured light level. If the weather service
  can't be reached within 8 seconds, Moonrise uses the astronomical sunset
  ([SunCalc](https://github.com/mourner/suncalc)) with no shift.
- **Suggested start time.** 45 minutes before estimated dusk by default. After 3+ logged
  evenings with at least one timed episode, it's the median time episodes began (relative
  to dusk) minus a 20-minute buffer, kept between 90 and 15 minutes before dusk.
- **Era music.** Songs from the person's ages 10 to 30 (the "reminiscence bump"). A song
  counts as played on an evening only if the caregiver opened its Spotify or YouTube link,
  and Moonrise can't confirm it was actually played. Each song scores +1 per calm evening and
  −1 per episode evening it was opened on. The best-scoring songs are suggested first, in
  random order among ties. Moonrise doesn't host audio.
- **AI-written memory prompts (optional).** In Settings, a caregiver can add their own
  Anthropic API key and tap Generate. Claude Haiku 4.5 (`claude-haiku-4-5`) then drafts a few gentle,
  personal memory prompts from the person's birth year and the optional anchors (hometown,
  spouse's first name, job). The caregiver reviews them and approves the ones they like;
  only approved prompts appear in Moonrise mode, alongside the built-in templates. Prompts
  about loss, illness or conflict are discouraged and some keywords are filtered. These
  checks cannot guarantee suitability: caregiver review is required. Generation needs a
  connection and API credits; approved prompts remain available offline.
- **Plain evidence, light progress.** Each song shows plain counts ("Opened on 5 logged
  evenings: 3 calm, 1 restless, 1 episode"), never a rating or a claim that it helps. Light,
  process-only milestones (first evening logged, first song opened, start time based on your
  logs, a week recorded) never reward outcomes. No model has been trained or clinically
  validated. What we tried instead of these simple rules, and why they stayed, is in
  [METHODOLOGY.md](METHODOLOGY.md).
- **Evenings after midnight.** Anything logged before 4 AM counts toward the previous
  evening, so late-night logs land on the right day.

### Demo data

Settings has a **Load demo week** button. It generates a realistic week of evening logs
from a seeded random function, so the learning and the report can be shown live. Demo
logs are clearly labelled and can be removed in one tap. Real evenings are never replaced.

## Privacy

Profiles, evening logs and approved prompts are saved in the browser's local storage.
There is no Moonrise account or backend. The network calls are weather and city lookups (Open-Meteo, which receives
coordinates or a city name), the song search links the caregiver chooses to open, and,
only if the caregiver sets up AI prompts and taps Generate, one request to the Anthropic
API with the birth year and the optional hometown, spouse and job answers. The profile
name, coordinates and evening logs are not sent. Anchors may themselves contain personal
names and places; the Settings screen explains the transfer before Generate. The API key
is stored in this browser, separately from app data, and sent to Anthropic to authenticate
requests. It is never bundled into the app, printed or included in the evening logs.
Because the browser calls the API directly, this is a prototype setup; a public release
would need a different key-management design. Use a dedicated demo key, remove it after
using a shared device, and do not commit it. Delete all data also removes the saved key.

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

**How it was made, and what AI was used.** Moonrise was built overnight at a hackathon ("Fly me
to the moon") by two people working with two AI coding agents: Claude Code on the engine and
integrations, and Codex on the UI. The agents coordinated through a GitHub issue. The two
illustrations (a night lake and a lunar-surface texture) are original images generated with
Higgsfield; `DESIGN.md` records the prompts, job IDs and where they're used. The moon's
phase on screen is computed live, and the artwork is decorative. At runtime, the only AI is
the optional caregiver-reviewed memory prompts (Claude, via the Anthropic API). The dusk
estimate, start time, song ranking and built-in prompts are the rules and templates
described above, not a model.
