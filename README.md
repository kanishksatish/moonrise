# Moonrise

**Prepare a familiar evening. Follow their lead. Carry the details forward.**

Moonrise is a caregiver-support prototype for evenings with a person living with dementia.
Its connected workflow starts with a personal plan: a familiar story or photo, preferences,
and topics to avoid. The caregiver offers story, music or quiet company, records choices
and observations, then reviews a source-linked session handoff. The person can decline or
stop at any point. Finish opens the evening indicators before the report. The handoff distinguishes caregiver entries from player events and
leaves missing observations unknown; it does not infer that an activity improved symptoms.

Sunset and weather provide an optional planning cue, not a clinical prediction. The separate
weekly journal retains the existing Calm, Restless and Episode observations. Music rankings
reflect associations in those logs, not proof that a song helps. No clinical predictor is deployed.

> Moonrise supports caregivers. It is **not** a medical treatment and does not diagnose,
> treat or prevent anything. Sudden changes in evening behaviour can have medical causes
> (pain, infection, medication), so mention them to a doctor.

The hosted app needs no hardware, account or backend. It is a web app (PWA) that runs on any tablet or phone. An optional laptop-only OpenAI demo gateway is described below; it is not deployed with the hosted app.

**Try it:** https://kanishksatish.github.io/moonrise/ · step-by-step test guide: [TESTING.md](TESTING.md).

**No patient data** was used to build or test Moonrise. Demo data is fictional and labelled; a caregiver's
own records stay in their browser. A separate public-dataset research benchmark (TIHM) is described in
[RESEARCH_RESULTS.md](RESEARCH_RESULTS.md); no model from it is in the app.

## How it works

| Step | What Moonrise does |
| --- | --- |
| Setup | Name, birth year, location (browser location or city search) and up to three optional memory anchors: hometown, spouse, job. |
| Today | A warm evening workspace with a personal plan, first-activity choices, one Start button with a skippable rocket launch, and a clearly fictional walkthrough. Sunset timing remains a secondary planning cue. |
| Shared session | A large story/photo, music or quiet view. The caregiver controls progression, can record started/declined actions, and can add an observation. Quiet and Finish stop playback. Draft observations must be added or cleared before Finish. |
| Session handoff | Timestamped actions, original source records, the preferences captured at session start, explicit missing observations, and a caregiver review tied to the exact record. This is a factual on-device summary, not an AI-generated clinical note. |
| Log | Three large observation buttons: **Calm**, **Restless**, **Episode**; optional onset time and explicitly recorded comfort steps. Unknown is distinct from a reported “none.” |
| Report | The session handoff followed by the separate printable weekly record. Recorded sessions and fictional examples have separate views. Song activity describes logged associations, not benefit or verified historical listening. |

Routine reminders remain active across caregiver screens while the app is open. Each stage is delivered at most once during that open app session, and reminders stop for an evening after the routine begins or a real observation is recorded. Browser notifications require permission; an on-screen reminder also offers a route back to Today. Delivery depends on the browser and device staying available; reloading starts a new reminder session.

The optional record is `log.careContext = { source: 'caregiver', comfortSteps: string[] }`.
Supported step IDs are `familiar-music`, `conversation`, `quiet-company`,
`lowered-stimulation`, and `stopped-session`. Missing or invalid context is unrecorded;
an explicitly saved empty array means none of these listed steps were reported.
The shared engine index exports the functions `cleanCareContext`, `comfortStepsText`,
`logsForHandoff`, and `handoffCoverage`, plus `CARE_PLAN_NOTE` (a string) and
`COMFORT_STEPS` (the five `{ id, label }` choices). These helpers describe records;
they do not recommend steps or use them to adjust the routine.

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
  up to the UI. The app uses no TIHM-trained predictive model, and nothing is clinically validated.
  A separate public-data experiment modestly improved event ranking using personal baselines,
  but did not support dependable alerts; see [the complete research results](RESEARCH_RESULTS.md).
  A further bounded tuning pass also failed to establish a supported alert policy.
  What we tried instead of
  the simple rules, and why they stayed, is in [METHODOLOGY.md](METHODOLOGY.md).
- **Evenings after midnight.** Anything logged before 4 AM counts toward the previous
  evening, so late-night logs land on the right day.

### Demo data

Settings has a **Load demo week** button. It generates a realistic week of evening logs
from a seeded random function, so the weekly report can be shown live. Demo logs are excluded from real routine timing. Demo
logs are clearly labelled and can be removed in one tap. Real evenings are never replaced.

## Privacy

Profiles, evening plans, session records, evening logs and approved prompts are saved in the browser's local storage.
Optional photos are resized to a maximum 960px JPEG and stored only in this browser's IndexedDB,
with a 20-photo limit. Original file names and metadata are not retained. Past sessions keep
references to their original photos and plans. Browser storage can be cleared or evicted; this
is not a clinical record system or a backup. Photos, prepared stories, caregiver preferences
and session events are excluded from generation requests.
The hosted app has no Moonrise account or backend. Its network calls are weather and city lookups (Open-Meteo, which receives
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
npm test         # all engine and UI tests (Vitest)
npm run build    # production build in dist/
npm run preview  # preview that built dist/; rebuild after source changes
```

The Vite development server updates from source and does not register the service worker.
A static preview serves `dist/`; run a fresh
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

### Optional OpenAI connection on this laptop

Build for the root path, then run `npm run local-ai` and open
`http://127.0.0.1:4180/connect`. Paste a dedicated OpenAI API key into the masked form,
then open Moonrise and go to Settings. This uses your OpenAI API credits. A configured
key is **not** a verified API connection; generation must succeed before live access can
be claimed. Nothing is generated or sent to OpenAI when a key is saved.

The Node server binds only to `127.0.0.1`, serves `dist/`, and retains the key in memory
until **Disconnect OpenAI** or process exit. `OPENAI_API_KEY` may alternatively be supplied
by the launch environment; never put a key in command arguments, a `VITE_` variable, a
committed file or browser storage. The setup page, API requests and replies are not cached.
App **Delete all data** removes browser data; disconnect the separate local server key
on the connection page or stop the server. Each local origin has its own browser profile
and approved prompts; hosted data is not automatically copied to this demo.

Only Settings **Generate** sends birth year and optional hometown, spouse and job answers
to OpenAI. Name, saved city/coordinates, evening logs and earlier prompts are excluded.
Anchor answers can themselves contain names or places. Drafts stay in screen memory;
only an explicit caregiver approval saves them to the routine. Built-in prompts remain
available. The fixed model is `gpt-4.1-mini-2025-04-14`, using structured Responses output,
`store: false`, at most 700 output tokens, a 30-second timeout, one in-flight request,
and at most three attempts per minute / twenty per hour. There are no model, URL or tool
controls in client requests. Host/Origin checks and a JSON-only custom-header protocol
reject cross-site requests; no CORS or public proxy is provided.

This gateway is for a laptop demo, not a public backend or phone connection. Keep the
process running and the laptop online for new drafts; stopping it forgets the key.
Settings only probes it from `http://127.0.0.1`. The public Pages app retains the existing
Anthropic flow and never probes a local gateway. OpenAI's `store: false` disables stored
Responses application state; it does not promise zero retention of abuse-monitoring logs.
See the official [model page](https://developers.openai.com/api/docs/models/gpt-4.1-mini),
[structured-output guide](https://developers.openai.com/api/docs/guides/structured-outputs),
and [data controls](https://developers.openai.com/api/docs/guides/your-data).

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
the optional caregiver-reviewed memory prompts (Claude via Anthropic in the hosted app, or OpenAI through the separately launched laptop demo gateway). The dusk
estimate, start time, song ranking and built-in prompts are the rules and templates
described above, not a model.
