# Moonrise demo runbook (3 minutes)

Times and lunar phase come from the real sky, forecast and stored logs. The lake and lunar
texture are decorative AI artwork; the visible rise is an illustration, not the moon's
astronomical path. The optional sample week is always labelled demo data.
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

> "In 2025, 12.7 million unpaid US caregivers gave 19.6 billion hours of care to
> people with dementia, and for many of them evening is the hardest part of the day.
> It's called sundowning."

Source: Alzheimer's Association, *2026 Alzheimer's Disease Facts and Figures* (hours and
caregivers are 2025 data). Verified in the primary report, printed page 52; see Sources.

### 2. Setup for a person born in 1942 (≈30 s)

1. Name: a fictional first name (e.g. "Rose"). **Never a real patient's name or details.**
2. Birth year: **1942**. The "Their songs: 1952 to 1972" card appears with era songs.
   *Say:* "We start with music from ages 10 to 30; the caregiver decides what feels familiar."
3. **Use my location** (or type the backup city → Find).
4. Anchors (optional): hometown, spouse's name, job. These become memory prompts.
5. **Start**.

### 3. Today: the real sky (≈30 s)

Point at the sky card:
- **Your evening begins at** with the countdown, which defaults to 45 min before estimated dusk.
- The moon, drawn in tonight's real phase.
- Tap **Tonight's sky · estimated dusk** to open the details: sunset, cloud %, and how many
  minutes Moonrise's prototype rule moves the estimate earlier (`cloud % / 100 × 30 min`).

*If today is clear:* "Clear sky today, so the estimate is right at sunset. On a fully overcast
evening, our rule moves it up to 30 minutes earlier." (Then show the cloudy-vs-clear split
in the report, step 5.)
*If the weather service is down:* the card says so and uses the plain sunset. Say that; it
is the designed fallback.

*The alert:* it fires 10 minutes before the start time, so it won't happen live in a morning
demo. Show the recorded clip, or point at "Turn on alerts".

### 4. Moonrise mode (≈40 s)

Tap **Start Moonrise now**. The routine fills the browser; native **Full screen** is optional:
- The surrounding gradient follows the real sun position; the lake remains a decorative
  night scene. *Say:* "The background and warm glow follow sunset. This illustrated moon
  rises slowly through the routine." Reduced-motion settings keep it still. Use the
  recorded evening clip to show the change over time.
- Big song title with Spotify / YouTube links (Moonrise doesn't host audio). **Open one of the
  links**: only songs whose link was opened are recorded for tonight's log, and so only those
  count toward "Songs from your evenings".
- A memory prompt in large text for the caregiver to read aloud, e.g. "Where were you when
  they landed on the moon in 1969?" (only for people born before about 1962).
- The person with dementia never has to read or press anything.

Tap **Finish** → Log.

### 5. The pattern: demo week and the report (≈40 s)

1. On Log, tap **Episode** (one tap), then optionally set a time (a time in the future is
   refused). Or skip logging and go on.
2. Settings → **Load demo week**. It's clearly labelled demo data, generated from a seeded
   random function. It never overwrites a real logged evening, and "Remove demo data"
   clears it in one tap.
3. Today: the suggested start time has **moved earlier**, and the card says it was adjusted
   from logged episodes. The constellation now has a star for each logged evening (demo
   stars are labelled). *Say:* "It adjusts the suggestion from the evenings you log: the
   median episode time minus a 20-minute buffer."
4. Report: the episode count, when episodes started relative to dusk, cloudy vs clear
   evenings, "Songs from your evenings" (an association, not proof a song caused
   anything), and the note to mention sudden changes to a doctor. Tap **Print** to show
   it's one page.

### Optional AI demonstration (≈30 s; shorten other steps to fit)

Before presenting, enter a dedicated API key privately in Settings. Never show or paste
a real key in a recording, repository or GitHub issue. With the fictional profile, tap
**Generate prompts**, wait for the live reply, then **Approve** one and **Skip** another.
Show the "Approved for your routine" list. Only approved text enters Moonrise mode; it
follows the first song prompt at the next three-minute rotation.

Say: "Claude drafts these conversation starters; the caregiver reviews each one before
using it. The dusk estimate and song ranking are simple rules." If the request fails, show
the error honestly and continue with built-in prompts. Previously approved text is saved,
but must not be presented as a new live generation. A successful real-key request is a
required pre-demo check; mocked tests and an invalid-key response do not establish it.

### 6. Close (≈10 s)

> "Every evening, we fly them back to the moon."

## Why it looks like daytime

The surrounding gradient in Moonrise mode uses the real sun position. Today's time and
lunar phase also use real inputs. The lake artwork stays moonlit and is not a live image
of the user's location. Use a recording of a real evening to demonstrate the dusk change.

## Say / don't say

- ✅ "Helps caregivers plan ahead for evening agitation." "Caregiver support." "Estimated
  dusk", "suggested start time", "songs from your evenings".
- ❌ "Knows when it gets dark", "learns which songs help", or calling the dusk estimate or
  song ranking "AI" (they're rules). The AI part is the optional caregiver-reviewed memory
  prompts written by Claude.
- ❌ "Treats", "prevents", "reduces sundowning", or any clinical outcome claim. Moonrise
  makes no medical claims.
- ✅ "Profiles and logs are stored on this device. Weather lookups send a location;
  chosen music links open their provider. Optional AI generation sends birth year and
  memory answers to Anthropic after the caregiver taps Generate."

## Sources

The opening numbers were verified directly on September 25, 2026 in the Alzheimer's
Association's [2026 Facts and Figures report](https://www.alz.org/getmedia/ef8f48f9-ad36-48ea-87f9-b74034635c1e/alzheimers-facts-and-figures.pdf),
printed page 52 (PDF page 54), "Hours of Unpaid Care and Economic Value of Caregiving".
They describe 2025, not a forecast. DOI: 10.1002/alz.71345. Avoid adding a sundowning
prevalence percentage to the stage pitch: estimates depend heavily on definitions and setting.
