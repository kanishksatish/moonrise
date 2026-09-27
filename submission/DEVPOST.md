# Moonrise: Devpost submission (copy-paste ready)

> **For Ketan:** every section below matches a field Devpost asks for ("What to submit" 1–5 and the
> "Before you hit submit" checklist). Copy each section into the matching Devpost box. Upload the
> screenshots from [`submission/screenshots/`](screenshots/). The only thing to add yourself is the
> **two video links** (marked `PASTE`). Deadline: **Sunday 12:00 PM Central.**

---

## Title

**Moonrise**

## Tagline (one line)

A calm evening routine for people living with dementia, timed to the real sky, so family caregivers can get ahead of the hardest hours of the day.

## Links

- **Live app (try it now, no login):** https://kanishksatish.github.io/moonrise/
- **Source code:** https://github.com/kanishksatish/moonrise
- **Video 1:** `PASTE LINK`
- **Video 2:** `PASTE LINK`
- **How to test it:** https://github.com/kanishksatish/moonrise/blob/main/TESTING.md

> When you show a video, say: *"This is a generated, fictional demonstration. The people aren't real patients."*
> Don't publish the version with the Frank Sinatra soundtrack; we don't have the rights to share it publicly.

---

## Explain it like I'm 5

Some grandmas and grandpas have an illness called **dementia** that makes their memory mixed up.
For many of them, the hardest time is **when the sun goes down**. They can get scared, confused or upset.
Doctors call this **"sundowning."**

The person looking after them (their **caregiver**, often their son, daughter or husband) is usually very tired.
The evening can sneak up on them.

**Moonrise is like a friendly alarm clock and a cozy night-light in one:**

1. 🌅 **It watches the real sky.** It knows when the sun sets where you live, and it knows that on a cloudy
   day it gets dark sooner. So it says: *"Start the calm routine at 6:30 tonight."*
2. 🌙 **It makes the screen into a gentle night sky.** A moon slowly rises, the light gets warm, and soft music
   plays, like a lullaby for grown-ups.
3. 💬 **It gives the caregiver nice things to talk about,** like *"Tell me about your hometown."*
4. ⭐ **After the evening, the caregiver taps one button:** Calm, Restless or Episode (a hard evening).
   Each evening becomes a star. Every evening counts, good or hard.
5. 🧠 **It learns from that family's own evenings.** If hard times usually start about an hour before dark,
   next time it suggests starting the calm routine a bit earlier.
6. 📄 **It makes a one-page report** the family can show a doctor or the next caregiver.

**It doesn't replace doctors or medicine.** It helps a tired caregiver be ready and keep good notes.

---

## 1. The problem and who it's for

**Who:** family caregivers of people living with dementia, and in the future the hospice and home-care teams
who support them. The caregiver uses the app. The person with dementia only sees the calm night-sky
screen and never has to read or press anything.

**The problem:**
- Nearly **13 million Americans** give unpaid care to someone with Alzheimer's or another dementia. In 2025 they gave
  **more than 19 billion hours** of care ([Alzheimer's Association, 2025 Facts and Figures](https://www.alz.org/news/2025/facts-figures-report-alzheimers-treatment)).
- **Late-day confusion and agitation ("sundowning") is common.** Estimates vary widely because definitions differ;
  one clinical study found it in **21% of 184 patients** (about 1 in 5)
  ([Toccaceli Blasi et al., *J. Alzheimer's Disease*, 2023](https://pubmed.ncbi.nlm.nih.gov/37334595/)).
- Evenings are hard to plan: sunset moves every day, clouds make it dark earlier, and a tired caregiver
  often notices the problem only once it has started. When the family talks to a doctor, they rarely have a clear record
  of what actually happened each evening.

**Why our approach is useful:**
- **Zero hardware:** it runs on any tablet or phone the family already has. No wearables, sensors or account.
- **Proactive:** it suggests a start time *before* the hard part of the evening, based on the real sky.
- **Personal:** it adjusts to that one person's logged evenings with simple rules anyone can check.
- **Private:** everything stays on the device.
- **Useful to clinicians:** a one-page printed record with a reminder to raise sudden changes with a doctor,
  because pain, infection or a medication change can also cause evening agitation.

## 2. The solution: what it does, page by page

(Screenshots are in [`submission/screenshots/`](screenshots/).)

| Page | How to get there | What it does | Screenshot |
|---|---|---|---|
| **Setup** | Opens the first time | Name, birth year, location (GPS or type a city), and optional memories (hometown, spouse, job) | `01-setup.png` |
| **Today** | Left menu (tablet) or bottom bar (phone) → **Today** | Choose tonight's activity (Story, Music, Quiet) and tap **Start Moonrise now**. The **sky card** shows the suggested start with a countdown, estimated dusk (sunset pulled earlier by clouds) and the moon phase | `02-today.png`, `03-today-sky-card.png`, `13-phone-today.png` |
| **Launch** | Tap **Start Moonrise now** | A 2-second rocket flight to the moon ("Fly me to the moon"). Can be skipped | `04-launch.png` |
| **Moonrise mode (music)** | **A little music** | A big calm panel with a sky that follows the real sky and a moon that rises over an hour. Plays licensed recordings inside the app (works offline) and shows **Now playing** | `05-moonrise-music.png` |
| **Moonrise mode (story)** | **A familiar story** | One large conversation starter for the caregiver to read aloud. It changes every 3 minutes. The caregiver can note what they noticed | `06-moonrise-story.png` |
| **Log** | Tap **Finish**, or menu → **Log** | Three giant buttons: **Calm**, **Restless**, **Episode**. Optional: when the episode started, and comfort steps used | `07-log.png`, `08-log-saved.png` |
| **Report** | Menu → **Report** | The week at a glance, plus **Print care handoff**. Demo data has its own clearly labelled **Fictional example preview** | `09-report-recorded.png`, `10-report-example-week.png`, `11-report-printed.png` |
| **Settings** | Menu → **Settings** | Edit the profile, optional AI conversation starters (caregiver approves each one), **Load demo week**, **Start over** (erase everything) | `12-settings.png` |

**Try it in 2 minutes:** open the live link → set up a fictional person born 1942 → **Start Moonrise now** → **A little music** → play **Für Elise** → **Finish** → tap **Episode** → **Report**.
Full step-by-step guide: [TESTING.md](../TESTING.md).

## What the app keeps track of (the evening indicators)

These are **things the caregiver records or the app calculates**. They are not medical measurements; Moonrise has no sensors.

| Indicator | Where it comes from | Why it's useful |
|---|---|---|
| **Evening outcome:** Calm / Restless / Episode | One tap by the caregiver | Shows how evenings are going over the week |
| **Episode start time** | Optional, entered by the caregiver | Shows *when* hard evenings begin |
| **Minutes before dusk** that the episode started | Calculated: start time vs that evening's estimated dusk | The key number the start-time suggestion learns from |
| **Estimated dusk** | Sunset (Open-Meteo) moved earlier by cloud cover in the 2 hours before sunset | Cloudy days get dark sooner |
| **Cloudy vs clear evenings** | Forecast cloud cover (50% or more counts as cloudy) | Shows whether hard evenings tend to be cloudy ones |
| **Recording that actually played** | Only when the player reports real playback | An honest music record (not "the song worked") |
| **Comfort steps used** | Optional caregiver checklist | Record of what was tried |
| **Caregiver observations** | Free text, e.g. "hummed along" | Details for the next caregiver |
| **Session timeline** | Automatic: offered, started, declined, stopped, finished | A handoff for the next caregiver or nurse |
| **Evenings not recorded** | Automatic | Makes gaps visible instead of hiding them |

## How Moonrise "learns" (and our training data), in plain words

**Inside the app: it learns from each family's own evenings, with simple rules you can check.**
- **Start time:** by default the routine starts **45 minutes before dusk**. After **3 logged evenings** with at least one timed
  episode, Moonrise looks at when episodes usually start compared to dusk (the *median*, so one odd night doesn't throw it off)
  and suggests starting **20 minutes earlier than that**, never more than 90 or less than 15 minutes before dusk.
- **Why rules and not a big AI model?** One family logs maybe 7 to 30 evenings. That's far too little to train an AI model.
  We tested "smarter" statistical versions on **1,000 simulated families** and the simple rules were more accurate
  ([METHODOLOGY.md](../METHODOLOGY.md)).

**Outside the app: we trained real models on a real public dementia dataset.**
- We used the public **TIHM dataset** ([Zenodo](https://zenodo.org/records/7622128)): about **1 million home-sensor readings from 56 people living with dementia**
  (motion, doors, appliances), with recorded agitation labels.
- **Explained like you're 5:** we showed a computer lots of days from those homes and asked, *"Can you guess which six-hour stretches will have agitation?"*
  We always tested it on **people it had never seen**, so it couldn't cheat.
- **What we trained:** logistic regression and gradient-boosting models, **over 250 model fits** in total, with a fixed plan decided before seeing results.
- **What we found:** comparing a person's recent activity with **their own normal** helped a little (ranking score 0.050 → 0.064).
  But it was **not accurate enough to send alerts**: when set to flag risky periods, only about 4–7% of flags were right.
- **So we did the responsible thing:** no prediction model went into the app. A wrong alert could scare a family or be ignored when it matters.
  Full results: [RESEARCH_RESULTS.md](../RESEARCH_RESULTS.md).
- **No real patient data is in the app or the repo.** The app's demo week is fictional and labelled everywhere.

## Why this matters

Moonrise's goal is to make the most difficult hours of a dementia caregiver's day **more predictable and better prepared**:
- It **gets the caregiver ready before evening**, not after the hard part has started.
- It turns the evening into a **familiar, calm routine** (music, light, conversation) that the caregiver leads.
- It gives **families, nurses and doctors a clear record** of what happened each evening, including a reminder that sudden changes
  can have medical causes (pain, infection, medication), so those are raised with a doctor sooner.
- It supports **exhausted caregivers**, whose own health is also at risk.

**Honest note:** Moonrise is a caregiver-support prototype. It has not been tested with patients, and we don't claim it treats or
prevents sundowning. The next step is a pilot with a hospice or care partner, with ethics review and family consent, to measure whether it helps.

---

## 3. Technology stack

| Category | What we used |
|---|---|
| **AI models (in the app)** | **Claude Haiku 4.5** (Anthropic API) drafts personal conversation starters; the caregiver approves each one. Optional laptop-only **OpenAI gpt-4.1-mini** gateway (Responses API) for the same feature |
| **AI / ML (research)** | Logistic regression and gradient boosting (participant-separated cross-validation) on the TIHM dataset |
| **AI dev tools** | **Claude Code** (engine, integrations, testing, deployment) and **Codex** (UI), coordinating through a GitHub issue. **Higgsfield** for 2 decorative illustrations |
| **APIs** | **Open-Meteo** Forecast API (sunset, hourly cloud cover) and Geocoding API (city search), free with no key |
| **Datasets** | **TIHM** public dementia home-monitoring dataset (research only); a curated seed list of 70 era songs (title/artist/year); **11 licensed recordings** (CC0, public-domain and CC BY/BY-SA, credited in the app) |
| **Libraries** | React 19, Vite 8, SunCalc (sun and moon position and phase), Zod, @anthropic-ai/sdk |
| **Platform** | Progressive Web App (installable, offline via service worker), plain CSS, localStorage and IndexedDB (on-device only) |
| **Testing** | Vitest + Testing Library (**508 automated tests**), Playwright (browser, offline and print checks) |
| **Hosting** | GitHub Pages via GitHub Actions |

## 4. Build story

**What we completed in the build window:**
- A complete, deployed, offline-capable app: Setup, Today (live sky card with countdown), Moonrise mode (real-sky gradient, rising moon,
  warm light, in-app music, rotating conversation starters), one-tap Log, printable Report and session handoff, and Settings.
- A transparent engine: effective dusk from sunset + clouds, a start time that adapts to logged evenings, and a weekly report.
- Optional AI conversation starters with a caregiver approval gate.
- Real model training on the TIHM dementia dataset, reported honestly.
- 508 automated tests, 26 offline checks, and a scripted full-evening browser run.

**Challenges and surprises:**
- **Two AI coding agents on one codebase.** Claude Code and Codex split engine vs UI and talked through a GitHub issue. Codex found
  a production-only offline bug (GitHub Pages serves MP3 files under a different type name), and Claude reproduced and fixed it.
- **Music rights.** YouTube videos wouldn't embed (error 150), and most classic recordings are still under copyright. We switched to
  11 recordings with clear licenses that play inside the app and offline.
- **Offline audio** needed special handling so you can skip around in a cached song.
- **The honest surprise:** our "smarter" models didn't beat simple rules for one family's data, and the TIHM models weren't precise
  enough for alerts. We kept the transparent rules and left prediction out of the app.

**What we learned:**
- For a tired caregiver, the small things matter most: big buttons, nothing that plays by itself, never losing an unsaved note, and
  clearly showing when something *wasn't* recorded.
- Testing on people the model has never seen is what separates a real result from a lucky one.
- Being honest about limits builds more trust than a flashy claim, especially in healthcare.

**What we'd build next:**
- A pilot with a hospice or home-care partner (ethics review, consent, caregiver usability sessions).
- **Multiple people per device** for care settings, with a per-person switcher and access controls.
- Background reminders that work when the app is closed.
- A secure server so families don't need their own AI key.
- Re-testing prediction only with consented, app-relevant data from a real pilot.

## 5. Credits (what's ours vs what we used)

**Our team's contribution:** the product idea and design, the whole app (engine and UI), the dusk and start-time rules, the report and
handoff, offline support, the tests, the research benchmark on TIHM, and the docs. Code was written by our two humans working with
AI coding agents (**Claude Code** and **Codex**).

**Existing tools and resources we used (thank you):**
- Open-Meteo (weather and geocoding), SunCalc (sun and moon), React, Vite, Zod, Vitest, Playwright, GitHub Pages.
- Anthropic Claude Haiku 4.5 and OpenAI gpt-4.1-mini (optional conversation-starter drafts).
- TIHM dataset (Zenodo record 7622128), used for research only; no records are in our repo.
- Music: 11 recordings, each with its license and performer credited in the app and in
  [`src/assets/audio/LICENSES.md`](../src/assets/audio/LICENSES.md) (for example, *Für Elise* by V Gao, CC0).
- Illustrations: 2 images generated with Higgsfield ([DESIGN.md](../DESIGN.md)).
- Promo videos: generated, fictional people and scenes, not real patients.

## Required disclosures (keep in the submission)

- Caregiver-support prototype. It does **not** diagnose, treat or prevent any condition. **No patient testing or clinical validation has been done.**
- **No patient data** was used in the app. Demo data is fictional and labelled. A family's own records stay on their device.
  Weather lookups send location to Open-Meteo. The optional AI sends only birth year and the memory answers, only when Generate is tapped.
- TIHM research is exploratory; no model from it is in the app.
- Video: generated fictional demonstration. The Sinatra soundtrack version isn't cleared for public release.

---

## Before you hit submit ✅

- [ ] Title: **Moonrise**
- [ ] Problem and audience (section 1)
- [ ] Solution (section 2 + indicators + learning)
- [ ] Technology list (section 3)
- [ ] Screenshots uploaded (from `submission/screenshots/`, at least 02, 03, 05, 06, 07, 11)
- [ ] Live demo link + repo link
- [ ] Both video links pasted
- [ ] Build story and lessons learned (section 4)
- [ ] Credits (section 5) and disclosures
- [ ] Submitted before **12:00 PM Central, Sunday**
