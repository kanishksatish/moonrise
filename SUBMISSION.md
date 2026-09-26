# Devpost submission draft: Moonrise

Draft text for each Devpost section. Before submitting, confirm the live AI check,
hosting status and final video link. Don't add claims about patients, clinical results
or AI prediction.

---

## Tagline

A calm evening routine for people living with dementia, timed to the real sky.

## Inspiration

In 2025, more than 12 million family members and other unpaid caregivers in the US gave an
estimated 19.6 billion hours of care to people living with Alzheimer's or other dementias
(Alzheimer's Association, *2026 Alzheimer's Disease Facts and Figures*, p. 52). For many
families the hardest part of the day comes as daylight fades. Late-afternoon and evening
confusion and agitation is often called *sundowning*. We wanted to help the caregiver get a
step ahead of the evening, with nothing but a tablet they already own. The hackathon theme,
"Fly me to the moon", gave us the image: every evening, a gentle moonrise.

## What it does

- **Estimates tonight's dusk** from local sunset and forecast cloud cover (a transparent
  prototype rule), and **suggests when to start** a calming routine, with a heads-up while
  the app is open.
- **Moonrise mode** is a full-screen, quiet routine with a decorative moonrise, today's
  calculated lunar phase, and screen colors that follow calculated sun position. It offers
  music and one memory prompt at a time for the caregiver to read aloud. It does not sense
  room lighting. The person with dementia does not have to read or press anything.
- **Song suggestions from the person's youth** (ages 10–30), plus direct playback of an
  included CC0 piano recording or an audio file the caregiver selects on the device.
  The piano works offline after it has been cached; a local file must be selected again
  after leaving the routine. No YouTube catalog recording is currently enabled.
- **Optional AI memory prompts.** With their own Anthropic API key, a caregiver can have
  Claude (Haiku 4.5) draft personal prompts from a few memory answers. **Nothing is used
  until the caregiver approves it.** The review flow is tested with simulated responses
  and live invalid-key handling; a successful real-key generation is still awaiting
  verification. Built-in prompts remain available without AI.
- **One-tap evening log** (Calm / Restless / Episode). The suggested start time then adapts to
  the family's own logs. After three logged evenings and at least one timed episode, it
  uses median onset relative to each evening's estimated dusk, with a 20-minute buffer
  and a limit of 15–90 minutes before tonight's estimated dusk. Otherwise it starts
  45 minutes before estimated dusk.
- **One-page printable weekly report** to share with family or a doctor. It includes a
  reminder that sudden changes can have medical causes (pain, infection, medication).
- **A gentle "constellation"**: one star per logged evening. Every kind of evening counts,
  with no streaks and no scores for the person.
- **Local storage with explicit online features.** No Moonrise account or backend. The
  profile, evening logs and approved prompts stay in this browser. Open-Meteo receives
  coordinates for weather or city text for lookup. Optional AI sends birth year/era and
  the memory answers as typed to Anthropic, using the caregiver's key; those answers
  can contain personal details. Profile name, coordinates and logs are not included in
  the AI request. The core routine and bundled piano work offline after a successful
  online production load, while cached data is retained. New AI prompts and weather
  updates require a connection.

## How we built it

- Vite + React + plain CSS, SunCalc and the Open-Meteo forecast and geocoding APIs (free,
  no key), Vitest (245 tests), Playwright browser checks, a service worker for offline use,
  and the Anthropic SDK for the optional prompts.
- **Two humans and two AI coding agents.** Claude Code built the engine and integrations,
  and Codex built the UI. The agents coordinated through a GitHub issue, reviewed each
  other's work, and verified tests, builds, print, offline and accessibility behavior.
  The final integrated app passed 245 automated tests and 26 offline checks, plus browser
  reviews at widths from 320 to 1280 pixels.
- Accessibility rules from day one: 20px minimum text, 48px minimum tap targets, contrast
  for dark rooms, reduced-motion support, and a report that fits on one printed page.

## Challenges we ran into

- **Honest learning with tiny data.** We compared Bayesian alternatives and simple rules
  using 1,000 simulated families with known synthetic answers. The simple rules performed
  better under the tested assumptions, so we retained them. `METHODOLOGY.md` records the
  method and limitations; these simulations do not establish clinical benefit or general
  superiority over other models.
- **Music availability.** Three tested YouTube candidates failed embedding (error 150),
  and all catalog candidates remain disabled until verified. The app instead bundles a
  CC0 piano recording and lets the caregiver select their own audio locally. No commercial
  recording is bundled in the app or repository.
- **Offline audio.** Seeking in a cached MP3 needed byte-range responses in the service
  worker.

## Accomplishments we're proud of

- A complete, tested app: offline, installable, accessible, with one-page print.
- Keeping the report descriptive: evening outcomes and song history, with no claim that a
  song caused an improvement. Per-song outcome counts exist in the engine but are not yet
  displayed. The app labels dusk and start times as estimates and suggestions.

## What we learned

For this prototype, transparent rules made small-sample behavior easier to inspect and
test. The simulation results depend on their assumptions; real caregiver usability and
clinical benefit still need separate evaluation.

## What's next

- Usability sessions with family caregivers.
- Clinical, ethics and privacy review with a care partner before any patient-facing pilot.
- Background reminders.
- A small server so AI prompts don't need a caregiver's own key.

## Built with

vite, react, css, javascript, suncalc, open-meteo, anthropic-claude, vitest, playwright,
service-worker, pwa, github-actions

---

## Required disclosures (keep these in the submission)

- **Caregiver-support prototype.** Moonrise is not intended to diagnose, treat or prevent
  a condition. **No patient testing and no clinical validation have been done.**
- **Estimates are rules, not predictions.** Dusk, start time and song ordering are simple,
  documented rules (`METHODOLOGY.md`). The only runtime AI is the optional,
  caregiver-approved memory prompts.
- **How AI was used to build it.** The code was written with AI coding agents (Claude Code
  and Codex). The two app illustrations were generated with Higgsfield (`DESIGN.md`).
- **Promo video.** The video is a **generated, fictional demonstration** with AI-generated
  people and scenes. It isn't real patients or real usage. Say so when presenting it.
  Its separate soundtrack uses a user-supplied Frank Sinatra recording; that recording
  is not included in the app or repository. Public soundtrack distribution rights have
  not been documented in this project.
- **Public data.** A separate research benchmark on the public TIHM dataset was completed with
  participant-separated testing. Its precision (about 4% of flagged six-hour windows matched a
  recorded agitation label) was insufficient to support predictive care alerts, so no model
  is connected to the app, and no data from it is in the app or repo (`METHODOLOGY.md`).
- **Music.** The included piano is a CC0 recording (provenance in `src/assets/audio/`).
  Catalog songs are suggestions; no commercial recordings are distributed with the app.

## Links to add

- Code: https://github.com/kanishksatish/moonrise
- Live app: https://kanishksatish.github.io/moonrise/
- Video: add the final demonstration link after resolving the public soundtrack rights.
