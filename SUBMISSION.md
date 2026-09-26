# Devpost submission draft: Moonrise

Paste-ready text for each Devpost section. Everything below matches what the app actually
does. Don't add claims about patients, clinical results or AI prediction.

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
- **Moonrise mode** is a full-screen, quiet routine: a sky that follows the real sky, a
  rising moon drawn in tonight's real phase, warm light as the room darkens, music, and
  one memory prompt at a time for the caregiver to read aloud. The person with dementia never
  has to read or press anything.
- **Music from the person's youth** (ages 10–30). There's an included public-domain (CC0)
  piano recording and a player for the caregiver's own audio files, and it works offline.
- **Optional AI memory prompts.** With their own Anthropic API key, a caregiver can have
  Claude (Haiku 4.5) draft personal prompts from a few memory answers. **Nothing is used
  until the caregiver approves it.**
- **One-tap evening log** (Calm / Restless / Episode). The suggested start time then adapts to
  the family's own logs: the median episode time minus 20 minutes.
- **One-page printable weekly report** to share with family or a doctor. It includes a
  reminder that sudden changes can have medical causes (pain, infection, medication).
- **A gentle "constellation"**: one star per logged evening. Every kind of evening counts,
  with no streaks and no scores for the person.
- **Private by design.** No account and no server; everything stays on the device. It's an
  installable web app that works offline after one visit.

## How we built it

- Vite + React + plain CSS, SunCalc and the Open-Meteo forecast and geocoding APIs (free,
  no key), Vitest (245 tests), Playwright browser checks, a service worker for offline use,
  and the Anthropic SDK for the optional prompts.
- **Two humans and two AI coding agents.** Claude Code built the engine and integrations,
  and Codex built the UI. The agents coordinated through a GitHub issue, reviewed each
  other's work, and each independently re-ran tests, builds, print, offline and
  accessibility checks before every merge.
- Accessibility rules from day one: 20px minimum text, 48px minimum tap targets, contrast
  for dark rooms, reduced-motion support, and a report that fits on one printed page.

## Challenges we ran into

- **Honest learning with tiny data.** A family logs 7–30 evenings, far too few to train a
  model. We built Bayesian alternatives to our simple rules and tested both on 1,000
  simulated families with known answers. The simple rules won, so we kept them and wrote up
  the method and results in `METHODOLOGY.md`.
- **Music rights.** Official YouTube uploads of era songs block embedding (error 150), so we
  ship a public-domain piano recording plus the caregiver's own files, and we never rehost
  recordings.
- **Offline audio.** Seeking in a cached MP3 needed byte-range responses in the service
  worker.

## Accomplishments we're proud of

- A complete, tested app: offline, installable, accessible, with one-page print.
- Keeping every claim honest. The app shows plain counts, never "this song helps", and says
  "estimated" wherever it estimates.

## What we learned

Small, transparent rules that you can test beat fancy models when the data is tiny. Saying
exactly what an app does *not* claim builds more trust than a bigger promise.

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

- **Not a medical device.** Moonrise supports caregivers. It doesn't diagnose, treat or
  prevent anything. **No patient testing and no clinical validation have been done.**
- **Estimates are rules, not predictions.** Dusk, start time and song ordering are simple,
  documented rules (`METHODOLOGY.md`). The only runtime AI is the optional,
  caregiver-approved memory prompts.
- **How AI was used to build it.** The code was written with AI coding agents (Claude Code
  and Codex). The two app illustrations were generated with Higgsfield (`DESIGN.md`).
- **Promo video.** The video is a **generated, fictional demonstration** with AI-generated
  people and scenes. It isn't real patients or real usage. Say so when presenting it.
- **Public data.** The team audited the public TIHM label file. Its six-hour agitation labels
  can't validate minute-level timing, so no model was trained on it and no data from it is
  in the app or repo.
- **Music.** The included piano is a CC0 recording (provenance in `src/assets/audio/`).
  Catalog songs are suggestions; no commercial recordings are distributed.

## Links to add

- Code: https://github.com/kanishksatish/moonrise (make the repository public first)
- Live app: https://kanishksatish.github.io/moonrise/ (after Pages is enabled and deployed)
- Video: upload the final promo MP4 (fictional demonstration)
