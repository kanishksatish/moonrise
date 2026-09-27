# How to test Moonrise

Live app: **https://kanishksatish.github.io/moonrise/** (Chrome, Safari or Edge; tablet or phone is best).
Use a made-up person for every test. Don't enter real patient details.

## 1. Ten-minute walkthrough

| # | Do this | You should see |
|---|---|---|
| 1 | Open the link. Enter a first name (e.g. "Rose") and birth year **1942**. Tap **Use my location** (or type a city and tap **Find**). Tap **Start**. | The Today screen. |
| 2 | Look at the blue sky card on Today. | **Start Moonrise** with a time and a countdown ("in 1 h 05 min"), **Estimated dusk**, and tonight's **Moon** phase. Open **Behind tonight's timing** to see sunset and the cloud adjustment. |
| 3 | Tap **Start Moonrise now**. (The 2-second rocket launch can be skipped.) | Moonrise mode: a sky that matches the real sky outside, and a moon that rises slowly over an hour. |
| 4 | Tap **A little music**. Choose **Für Elise** and press Play. | The piano plays inside the app. The big panel shows **Now playing · Für Elise**. Tap **Stop music** to stop it. |
| 5 | Tap **A familiar story**. | One conversation starter in large type for the caregiver to read aloud. It changes every 3 minutes, or with **Next prompt**. |
| 6 | Type something under **What did you notice?** and tap **Add observation**. Then tap **Finish**. | You land on Log. |
| 7 | Tap **Episode** and enter a start time (e.g. 6:05 PM). | The evening is saved. The Today screen shows it as recorded, and a star appears in the constellation. |
| 8 | Reload the page. | Everything is still there. Nothing is lost. |
| 9 | Open **Report**. Tap **Print care handoff** (or use Print preview). | Page 1: the weekly summary (evenings, onset vs dusk, cloudy vs clear, music activity, night by night, and the note to mention sudden changes to a doctor). Page 2: tonight's session handoff for the next caregiver. |
| 10 | Open **Settings**, tap **Load demo week**, go back to Today. | A labelled **Demo week** line shows how the start time shifts with a week of logs. Report → **Fictional example preview** shows the demo week, marked fictional on every row. |

## 2. Works without internet

1. Open the live app once while online and wait about 10 seconds.
2. Turn on airplane mode, then reload.
3. The app opens, and **Für Elise** still plays. The Today screen uses the last saved weather. Other
   recordings play offline once each has finished downloading (the player shows which ones are ready).

## 3. Optional AI conversation starters

1. Create a key at https://console.anthropic.com → **API keys**. Set a low spending limit. Never paste
   the key into chat, email or GitHub.
2. In the app: **Settings → Conversation starters → Set up your API key**, paste the key, fill in one or two memory answers
   (hometown, spouse, job), and tap **Generate prompts**.
3. Within about 10 seconds, draft starters appear. **Approve** one; it now appears in Moonrise mode.
   An error message means the key is wrong or has no credit. The built-in starters keep working either way.
4. Remove the key in Settings after the demo. It's stored in this browser only.

Only the birth year and those memory answers are sent to Anthropic, and only when you tap Generate.
Names, location, logs and photos are never sent.

## 4. What a hospice would need to check before real use

Moonrise is a caregiver-support prototype. It has **not** been tested with patients, caregivers or a
hospice, and it is not a medical device or a monitored alert service. Before a pilot:

- **Clinical and ethics review** of the routine, the wording and the doctor/care-team note, with the
  hospice's clinical lead.
- **Privacy and consent.** Data stays on the device, so decide who can use the tablet, set a screen lock,
  and agree how printed handoffs are handled. Use Settings → **Start over** to clear a device.
- **Usability sessions** with family caregivers, using fictional scenarios first.
- **Device setup.** Load the app once online on each tablet, confirm offline playback, keep the app open
  for reminders (background notifications are not guaranteed), and turn off auto-lock during a session.
- **AI.** Leave it off, or use a hospice-owned key with a spending limit. Every draft needs caregiver approval.

## 5. For developers

```bash
npm ci
npx vitest run                  # 508 tests
npm run build
node scripts/verify-offline.cjs # 26 offline checks against a production build (needs Playwright)
```
