# Moonrise demo runbook (3 minutes)

Everything on screen is computed live from the real sky, the weather and the stored logs.
**Nothing is staged or hardcoded.** That's a rule from the brief, and it's also the pitch.
This runbook shows what to tap and what to say, and what to do when the real world doesn't cooperate.

## The night before

- [ ] **Record a real evening run** (screen recording, about 60 s): Today screen with the
      countdown near zero and the heads-up alert, then Moonrise mode at actual dusk with the
      sky gradient darkening and the moon rising. A morning demo can't show dusk live
      (see "Why it looks like daytime" below). This clip is the honest backup.
- [ ] Deploy or run the build you'll demo, open it **online once** on the demo tablet
      (and again after any redeploy, so the offline copy is current).
- [ ] Settings → **Delete all data** so Setup starts fresh.
- [ ] Tablet: charged, auto-lock off, brightness high, Do Not Disturb on, browser notifications
      for Moonrise allowed (tap "Turn on alerts" once on Today).
- [ ] Have a backup city ready to type in case location permission is slow (e.g. the
      venue's city).

## Script

### 1. The problem in one sentence, one stat (≈20 s)

> "Last year, over 12 million unpaid US caregivers gave 19.6 billion hours of care to
> people with dementia, and for many of them evening is the hardest part of the day.
> It's called sundowning."

Source: Alzheimer's Association, *2026 Alzheimer's Disease Facts and Figures* (hours and
caregivers are 2025 data). See "Sources" below, and **click through to confirm the exact
wording before presenting**.

### 2. Setup for a person born in 1942 (≈30 s)

1. Name: a fictional first name (e.g. "Rose"). **Never a real patient's name or details.**
2. Birth year: **1942**. The "Their songs: 1952 to 1972" card appears with era songs.
   *Say:* "Music from ages 10 to 30, the reminiscence bump, is what people remember best."
3. **Use my location** (or type the backup city → Find).
4. Anchors (optional): hometown, spouse's name, job. These become memory prompts.
5. **Start**.

### 3. Today: the real sky (≈30 s)

Point at the sky card:
- **Estimated dusk** plus the line under it: sunset, cloud %, and how many minutes the clouds
  pull dusk earlier (`cloud % / 100 × 30 min`).
- **Start Moonrise at** with the countdown, which defaults to 45 min before dusk.
- The moon phase.

*If today is clear:* "Clear sky today, so dusk is right at sunset. On an overcast evening it
comes up to 30 minutes sooner." (Then show the cloudy-vs-clear split in the report, step 5.)
*If the weather service is down:* the card says so and uses the plain sunset. Say that; it
is the designed fallback.

*The alert:* it fires 10 minutes before the start time, so it won't happen live in a morning
demo. Show the recorded clip, or point at "Turn on alerts".

### 4. Moonrise mode (≈40 s)

Tap **Start Moonrise now**. Full screen:
- The sky gradient follows the **real** sky right now, so in the morning it's daytime blue.
  *Say:* "At dusk this deepens to night, the moon rises, and the screen gets warmer and
  brighter as the room gets darker." Then **play the recorded dusk clip** to show it.
- Big song title with Spotify / YouTube links (Moonrise doesn't host audio). **Open one of the
  links**: only songs whose link was opened are recorded for tonight's log, and so only those
  count toward "Songs linked with calmer evenings".
- A memory prompt in large text for the caregiver to read aloud, e.g. "Where were you when
  they landed on the moon in 1969?" (only for people born before about 1962).
- The person with dementia never has to read or press anything.

Tap **Finish** → Log.

### 5. The learning: demo week and the report (≈40 s)

1. On Log, tap **Episode** (one tap), then optionally set a time (a time in the future is
   refused). Or skip logging and go on.
2. Settings → **Load demo week**. It's clearly labelled demo data, generated from a seeded
   random function. It never overwrites a real logged evening, and "Remove demo data"
   clears it in one tap.
3. Today: the start time has **moved earlier**, and the card says it was learned from logged
   episodes. *Say:* "It learns from the evenings you log: the median episode time minus
   a 20-minute buffer."
4. Report: the episode count, when episodes started relative to dusk, cloudy vs clear
   evenings, "Songs linked with calmer evenings" (an association, not proof a song caused
   anything), and the note to mention sudden changes to a doctor. Tap **Print** to show
   it's one page.

### 6. Close (≈10 s)

> "Every evening, we fly them back to the moon."

## Why it looks like daytime

Moonrise mode and the Today card use the real sun position for your location. That's the
point: the routine is timed to *this* evening's sky. We don't fake a dusk for the stage,
which is why the dusk footage is a recording of a real evening run.

## Say / don't say

- ✅ "Helps caregivers get ahead of evening agitation." "Caregiver support."
- ❌ "Treats", "prevents", "reduces sundowning", or any clinical outcome claim. Moonrise
  makes no medical claims.
- ✅ "All data stays on the tablet. No account, no server."

## Sources

Checked from search results during the build. The primary pages were not reachable from
the build sandbox, so confirm each one before presenting.

- **Caregiver burden (used in the opening).** Alzheimer's Association, *2026 Alzheimer's
  Disease Facts and Figures*, Alzheimer's & Dementia (2026), doi:10.1002/alz.71345.
  "More than 12 million family members and other unpaid caregivers provided an estimated
  19.6 billion hours of care" in 2025.
  <https://www.alz.org/alzheimers-dementia/facts-figures>. Don't mix in numbers from the
  2025 edition (it says "nearly 13 million" / "more than 19 billion hours").
- **How common sundowning is (if asked).** Estimates vary widely: 2.5% to 66% depending on
  setting and definition. Canevelli M. et al., "Sundowning in Dementia: Clinical Relevance,
  Pathophysiological Determinants, and Therapeutic Approaches," *Frontiers in Medicine*,
  2016. <https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2016.00073/full>.
  The same review links sundowning with greater caregiver burden and institutionalisation.
  Say "up to two in three" only with the "up to".
- **Community vs care homes (UK charity estimate).** About 20% of people with dementia
  living at home, up to about 80% in residential care. Alzheimer's Society, "Sundowning and
  dementia." <https://www.alzheimers.org.uk/about-dementia/stages-and-symptoms/dementia-symptoms/sundowning>
