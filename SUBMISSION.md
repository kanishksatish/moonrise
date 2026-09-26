# Devpost submission draft: Moonrise

Draft reflects the connected evening workflow on the `claude-ui` review branch. Confirm the submitted deployment and final video before
publishing; the latest source is not claimed to be deployed. The laptop's optional OpenAI
connection currently needs reconnection and a fresh generation check.

## Tagline

Prepare familiar company. Follow their lead. Carry the evening forward.

## Inspiration

We wanted to simplify a caregiver's evening: a time to begin, music to choose together,
an invitation to talk, and somewhere to note what happened. “Fly me to the moon” became
a quiet observatory on a tablet. The moon rises, the screen grows warm, and the caregiver
can follow their person's lead—even when that means stopping the music and sitting together.

## What it does

- **Know the person.** Prepare a familiar story, optional on-device photo, caregiver cues,
  topics to avoid, and the activities to offer. Each session captures its own plan so later
  edits do not rewrite what was prepared for an earlier evening.
- **Follow their lead.** Offer a story, music or quiet company. Record a decline without
  treating it as failure. Add an observation in the caregiver's own words. Nothing advances
  automatically and an unfinished note is protected when Finish is pressed.
- **Carry the details forward.** A timestamped session handoff links each action to its
  original source. Player-reported playback stays distinct from caregiver entries. A review
  applies to the exact record and becomes pending after a change. Missing observations
  remain unknown. This is a factual on-device summary, not an AI clinical note.
- **Plan the evening.** Moonrise estimates dusk from sunset and forecast cloud cover. Its
  default start is 45 minutes before estimated dusk. After three logged evenings with at
  least one timed episode, it uses median onset relative to dusk minus 20 minutes, bounded
  to 15–90 minutes before dusk. These are documented prototype rules, not predictions.
  Routine reminders work across caregiver screens while the app is open; browser and
  device availability still control delivery.
- **Share a quiet routine.** A large, calm shared view centers the selected story, photo, music or quiet company. The caregiver reads aloud. Stop music, Quiet view and
  Finish remain easy to reach. The artwork is decorative; the app does not sense room light.
- **Play real music.** Eleven included recordings have native playback controls and visible
  source and license credits. The shared library is not matched to birth year. A caregiver
  can also select a personal audio file without uploading it. Nothing autoplays.
- **Keep useful notes.** Calm, Restless or Episode records the evening, with optional onset
  time and caregiver-reported comfort steps. Unrecorded details stay distinct from “none.”
  A printable weekly handoff shows observations, missing evenings and music activity;
  fictional examples have a separate view. Song associations do not establish benefit.
- **Count evenings without grading them.** One constellation star represents a logged
  evening. Every outcome counts equally, with no streaks or patient scores.
- **Review optional suggestions.** Built-in starters work without AI. Optional Anthropic
  or laptop-only OpenAI generation produces drafts; only explicit caregiver approval adds
  them to the routine. Suggestions can be wrong and are not care recommendations.

## How we built it

Two people worked with Claude Code and Codex, coordinating through a GitHub issue. We used
React, Vite, plain CSS, SunCalc, Open-Meteo and a service worker, designing around 20px body
text, 48px controls, visible keyboard focus and reduced motion.

The offline app and Für Elise install first. Ten additional recordings download
independently, so a failed extra download cannot block the core app. Each track shows its
actual offline availability; missing tracks offer the saved piano fallback. Complete
cached recordings support seeking. Browser storage eviction can remove downloads.

The redesigned app has **498 automated checks across 37 files**. Local verification passed
495 checks in the full run; three old button-label expectations were then updated, and
all 28 checks in those two files passed. The production build passed. Exact-commit CI is
recorded in the current handoff once complete.
Developer browser checks of the redesign covered phone/desktop layouts, local photo
persistence, explicit choices, source inspection, caregiver review and demo separation.
Earlier checks covered native/offline playback, missing extra music, keyboard navigation
and reduced motion. The expanded report print layout still needs a fresh rehearsal.
These are software checks, not representative caregiver
usability testing or clinical validation.

## Challenges we ran into

**Dependable offline audio.** We separated core installation from music downloads and
added byte-range seeking. Only actual playback records a track; selecting or unsuccessfully
loading it does not. Historical records are not reinterpreted as verified listening.

**Visible save failures.** Profile edits, evening notes and selected starters retain pending
changes, explain failed device saves and offer a retry. Optional details preserve the
difference between unknown and none.

**Research that did not support alerts.** A separate public TIHM sensor-data experiment
improved logistic event-ranking average precision from 0.0504 to 0.0640 using personal
baselines on the same participant-separated cohort. Average precision is not alert
accuracy. A further fixed 200-fit comparison also failed the precision and support
requirements. We reported the unsuccessful results and kept every research predictor
outside the app. [RESEARCH_RESULTS.md](RESEARCH_RESULTS.md) gives the full findings.

## Accomplishments we're proud of

A routine that carries through preparation, listening, stopping and recording the evening.
The music plays, offline status is specific, and the handoff separates observations from
missing information. Quiet company remains a valid choice.

We verified the local OpenAI path with a fictional profile: one real request returned six
drafts, and exactly one approved starter was saved and displayed. That earlier success
is documented. The memory-only key was subsequently lost when its process ended; the
current connection is unconfigured and needs reconnection and a fresh check. Saved
approved starters remain available.

## What we learned

Canceling buffered playback, keeping keyboard focus and protecting an unsaved note matter
as much as the main screen. Transparent rules made small-data behavior inspectable.
Neither our software checks nor the separate research establishes clinical benefit.

## What's next

- Representative caregiver usability sessions using fictional scenarios.
- Clinical, ethics, privacy and consent review before any patient-facing pilot.
- More dependable background reminders and appropriate public-release key management.
- Independent participants and app-relevant inputs before any further predictive evaluation.

## Built with

React, Vite, JavaScript, CSS, SunCalc, Open-Meteo, Vitest, service workers, GitHub Actions,
Anthropic, OpenAI Responses API, Claude Code, Codex, Higgsfield.

## Required disclosures

- **Caregiver-support prototype.** Moonrise does not diagnose, treat or prevent a condition.
  No patient testing, clinical validation or hospice validation has been done. The handoff
  reminds caregivers to discuss sudden changes with a clinician. Representative caregiver
  usability testing is still a separate next step.
- **Data and providers.** Profiles, plans, session records, logs and approved starters live in browser storage;
  resized photos stay in local IndexedDB and are excluded from generation;
  no Moonrise account is needed. Open-Meteo receives coordinates or city-search text.
  Generate sends birth year and optional hometown, spouse and job answers to the selected
  provider. Those answers may identify someone; profile name, coordinates and logs are
  excluded. The Anthropic path uses a caregiver-supplied browser-stored key. The separate
  loopback-only OpenAI gateway keeps its key in server memory and is not a public backend.
- **AI and generated media.** Claude Code and Codex assisted development. Two decorative
  app illustrations were generated with Higgsfield; see [DESIGN.md](DESIGN.md). The promo
  uses generated fictional people/scenes and an illustrated interface. It is not footage
  of patients or evidence of real-world use.
- **Music and promo rights.** The eleven app recordings retain individual licenses,
  performance/restoration credits and modification notes in the app and
  [audio credits](src/assets/audio/LICENSES.md). The separate promo uses a user-supplied
  Frank Sinatra recording, which is not bundled in the app or repository. Its public
  distribution rights have not been documented. Resolve those rights or replace the
  soundtrack before public release.
- **Research boundary.** TIHM findings are exploratory, with repeated development on the
  same cohort and incomplete clinical labels. Sensor records are not counts of patients;
  unlabelled windows are not confirmed clinical negatives. No tested alert policy met
  its fixed requirements. The app neither collects those sensors nor runs a trained
  predictor; participant records and fitted models are outside this repository.
  Hospice applicability and research-data deployment rights remain unresolved.

## Submission links to confirm

- Code: [Moonrise repository](https://github.com/kanishksatish/moonrise)
- App candidate: [Moonrise on GitHub Pages](https://kanishksatish.github.io/moonrise/) — verify the submitted version;
  this draft does not establish that the latest source is deployed.
- Video: add the final demonstration link after resolving the soundtrack rights.
