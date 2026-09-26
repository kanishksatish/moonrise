# Moonrise

**A calm evening routine for people with dementia, timed to the real sky.**

Many people living with dementia become more confused or agitated as daylight fades, often
called *sundowning*. Moonrise helps family caregivers plan ahead for it. It **estimates** this
evening's dusk from local sunset and cloud cover, suggests a time to start a calming routine,
and reminds the caregiver while the app is open. The routine is gentle and full-screen:
warm light that brightens as the sky darkens, an included listening library, in-app audio controls, and simple
memory prompts. After each evening, one tap records how it went. Moonrise then adjusts its
suggested start time from the logged evenings, and summarizes recorded song activity.
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
| Moonrise mode | A full-screen sky, a slowly rising moon, warm light, a visible picker of included licensed recordings, native playback controls or a caregiver-selected local audio file, and one memory prompt at a time. Verified YouTube recordings remain optional when available. |
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
- **Music.** The included licensed recordings are real local MP3s, selected by title in the
  listening library and played with native audio controls. This is a shared collection,
  not music matched to a birth year. Each recording has visible source and license credits
  in **About this recording** and an immutable `bundled-` ID. Only an actual native `playing`
  event records that ID, once per evening; selecting, loading, or failing to play does not.
  This does not establish listening duration or benefit. Old era-song IDs retain their
  meaning, and historical piano or personal-file activity is not reconstructed. The report
  can display old era songs and newly played included recordings together, with unknown
  recording years omitted. Era ranking remains separate internally. Optional YouTube
  playback still requires a verified recording; the unverified candidates are not shown as
  playable songs. **Play a music file** uses a temporary local file without uploading or
  assigning it a catalog ID. Nothing autoplays; changing a recording, Quiet view, and Finish
  stop playback. Full recording/source/license details are in `src/assets/audio/catalog.json`.
- **AI-written memory prompts (optional).** In Settings, a caregiver can add their own
  Anthropic API key and tap Generate. Claude Haiku 4.5 (`claude-haiku-4-5`) then drafts a few gentle,
  personal memory prompts from the person's birth year and the optional anchors (hometown,
  spouse's first name, job). The caregiver reviews them and approves the ones they like;
  only approved prompts appear in Moonrise mode, alongside the built-in templates. Prompts
  about loss, illness or conflict are discouraged and some keywords are filtered. These
  checks cannot guarantee suitability: caregiver review is required. Generation needs a
  connection and API credits; approved prompts remain available offline.
- **Plain evidence, light progress (engine support).** The engine can describe each song
  with plain counts ("Played in the app on 5 logged evenings: 3 calm, 1 restless, 1 episode"), never a
  rating or a claim that it helps. It also provides process-only milestones (first evening
  logged, first song played in the app, start time based on your logs, a week recorded) that never
  reward outcomes and flag any use of demo data. Whether and how the screens show these is
  up to the UI. The app uses no TIHM-trained predictive model, and nothing is clinically validated (a separate TIHM research benchmark had too little precision to use). What we tried instead of
  the simple rules, and why they stayed, is in [METHODOLOGY.md](METHODOLOGY.md).
- **Evenings after midnight.** Anything logged before 4 AM counts toward the previous
  evening, so late-night logs land on the right day.

### Demo data

Settings has a **Load demo week** button. It generates a realistic week of evening logs
from a seeded random function, so the learning and the report can be shown live. Demo
logs are clearly labelled and can be removed in one tap. Real evenings are never replaced.

## Privacy

Profiles, evening logs and approved prompts are saved in the browser's local storage.
There is no Moonrise account or backend. The network calls are weather and city lookups (Open-Meteo, which receives
coordinates or a city name), YouTube when the caregiver explicitly loads an available player, and,
only if the caregiver sets up AI prompts and taps Generate, one request to the Anthropic
API with the birth year and the optional hometown, spouse and job answers. The profile
name, coordinates and evening logs are not sent. Anchors may themselves contain personal
names and places; the Settings screen explains the transfer before Generate. The API key
is stored in this browser, separately from app data, and sent to Anthropic to authenticate
requests. It is never bundled into the app, printed or included in the evening logs.
Because the browser calls the API directly, this is a prototype setup; a public release
would need a different key-management design. Use a dedicated demo key, remove it after
using a shared device, and do not commit it. Delete all data also removes the saved key.
YouTube receives playback/device information and may show ads or use cookies; privacy-enhanced
mode limits personalization but does not eliminate data sharing. No profile name, anchors or
logs are sent to YouTube. Included recordings are served with the app; selected local audio stays in
the browser through a temporary object URL and is neither uploaded nor saved into the profile.

## Run it

Requires Node.js 22.12 or newer (needed by Vite 8 and Vitest 5).

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests (Vitest)
npm run build    # production build in dist/
npm run preview  # preview that built dist/; rebuild after source changes
```

The Vite development server updates from source and does not register the service worker.
A static preview (including the local preview on port 4177) serves `dist/`; run a fresh
root-path build and reload it after changes. Test a subpath build separately, for example
`VITE_BASE=/moonrise/ npm run build -- --outDir dist-subpath`, so the normal preview is not replaced.
The initial production install atomically saves the app and Für Elise, without waiting
for the ten additional recordings. Those recordings download independently in the background
after activation, or when requested. The picker reports each track's offline availability;
an older worker or unavailable status channel is shown as unknown, never as downloaded.
Only complete, validated audio responses are cached, with byte-range seeking supported.
An extra recording's network or storage failure does not block the core app or erase other
downloaded tracks. Failed core updates retain the previous complete core. Missing offline
recordings offer the piano fallback. Other audio and YouTube are never cached. Browser
storage eviction can remove offline data, and status is checked again when the app reconnects.

## Project layout

```
src/engine/     Pure logic with unit tests: sky, schedule, songs, report, moon, prompts,
                demo data, storage, evening dates, city lookup. index.js is the
                contract the UI imports from.
src/data/       songs.json: era songs; videos.json: candidate IDs and verification evidence.
src/assets/audio/ Included licensed MP3s and their catalog, source, license, and hash provenance.
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
