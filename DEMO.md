# Moonrise · v2 demo runbook

A three-minute walkthrough of the working caregiver prototype. Use fictional details throughout. The illustrated rocket, lake and lunar texture create atmosphere; times and lunar phase use real inputs. Sample logs are explicitly labeled demo data and demonstrate software behavior, not clinical evidence.

## Before presenting

- Open the exact build online on the presentation device. Reopen after any update so its cached version is current; confirm which build you are showing.
- Prepare a fictional profile such as Rose, born in 1942, with invented anchors. For the fastest demo, begin in **Settings → Edit details** rather than deleting the prepared profile.
- If showing live AI, save a dedicated Anthropic key privately, complete a successful real-key request beforehand, and remove it after using a shared device. Do not put a key in slides, recordings or GitHub. A mock response or invalid-key error is not a successful live test.
- Prepare the optional demo week and a recorded backup of the actual build. Label any recording and any saved AI response as such. Keep a screenshot of the printable report only after checking its pagination on the presentation device.
- A morning presentation will not reproduce dusk live. If useful, record a real evening session ahead of time; do not accelerate the clock and call the result live astronomy.

## The three-minute story

**0:00–0:20 · The person behind the routine**

“An evening can mean music, a familiar story, and a little more support for the person caring for someone. Moonrise brings those steps into one simple routine.”

Optional sourced context: in 2025, 12.7 million unpaid US caregivers provided 19.6 billion hours of care to people with Alzheimer’s or other dementias. These figures do not measure Moonrise’s benefit. The original handoff verified them in the [2026 Alzheimer’s Association Facts and Figures report](https://www.alz.org/getmedia/ef8f48f9-ad36-48ea-87f9-b74034635c1e/alzheimers-facts-and-figures.pdf), printed page 52, DOI 10.1002/alz.71345.

**0:20–0:45 · Personal setup**

Show **Who’s this evening for?** and **A few familiar details**. Enter 1942 and say, “Birth year shapes the conversation starters.” Point out the included listening library. Say, “That is a starting collection; the caregiver decides what feels familiar.” Use **Find** for a city if geolocation is unavailable. Finish with **Save** for an existing profile, or **Start** for a new one.

**0:45–1:10 · The evening dashboard**

Show the sky card (**Start Moonrise** with its countdown, **Estimated dusk**, today’s calculated **Moon** phase) and **Behind tonight’s timing**. Say, “This is a prototype timing rule using sunset, cloud cover and the evenings we log.” The default is 45 minutes before estimated dusk; cloud cover can move that dusk estimate up to 30 minutes earlier. If weather is unavailable, name the visible fallback. The artwork is not a live view of the location.

**1:10–1:40 · AI the caregiver chooses**

Tap **Make it personal** to open Settings. With the prepared fictional profile and key, tap **Generate prompts**. Read a draft, **Approve** one and **Skip** another. Say, “Claude drafts conversation starters. The caregiver chooses what belongs in the routine.” This is the runtime AI; timing and song ordering use rules. If generation fails, show the error honestly and continue with built-in or previously approved prompts. Do not call saved text a new live generation.

**1:40–2:15 · A little space for calm**

Return to Today and tap **Start Moonrise now**. The silent rocket flight lasts 2.4 seconds and can be bypassed with **Skip launch**, Escape, or reduced-motion settings. It occurs only after an explicit start.

In the routine, point to the sky behind the activity: it follows the real sky, and the moon rises slowly over an hour. Choose **A little music**, pick an included recording and press its native Play control (or **Play a music file**, which plays here without uploading). The stage then shows **Now playing** with that recording's title; only actual playback is recorded. Choose **A familiar story** for one conversation starter at a time; it changes every 3 minutes or with **Next prompt**. Only caregiver-approved AI text enters this view.

Tap **Quiet view**, then **Show conversation**. Say, “The caregiver can put the controls aside for a moment.” Quiet view stops this app’s audio and hides the cards. A local recording must be selected again afterward. Tap **Finish** to reach Log.

**2:15–2:45 · Every evening counts**

Choose **Calm**, **Restless**, or **Episode**. Episode offers an optional onset time; future times are rejected. After midnight, the evening stays grouped with the prior day until 04:00. Each logged evening adds one constellation star regardless of outcome.

In Settings, **Load demo week** adds seeded, made-up observations without replacing real logged dates. Explicitly say “demo data.” Back on Today, the sky card shows a labelled **Demo week** line: what the same rule gives with the example evenings, next to the unchanged real suggestion. The demo generator deliberately includes patterns to exercise the app; these are not findings from patients.

**2:45–3:00 · A record worth sharing**

Open Report, choose **Fictional example preview**, and show timing, cloudy vs clear evenings, **Recorded music activity**, the night-by-night table, the doctor note, and print (one page). Missing weather and unlogged dates remain visible. The report describes observations; it does not prove that music or the app caused a change. Close: “A familiar song. A moment together. A small note for tomorrow.”

## Honest fallback and wording

If live weather, AI or YouTube is unavailable, continue with the included piano or a local recording. After a successful online production install, the app caches its shell, artwork and complete piano file; saved profile, logs and approved prompts remain in local storage. Confirm offline playback on the presentation device before the demo. Fresh AI and YouTube require connectivity. Alerts require the app to remain open; do not promise background notifications.

Use “caregiver support,” “suggested routine,” “prototype rule,” and “recorded evenings.” Avoid “treats,” “prevents,” “reduces agitation,” “predicts sundowning,” “learned the best treatment,” “clinically proven,” or “hospice-ready.” A good-looking demo and public-data evaluation do not establish clinical effectiveness.

Profiles and logs are stored in this browser. Weather requests use location. Loading an available YouTube player sends playback/device information to that provider; the included piano and local-file choice do not. Selected local audio is not uploaded or retained after the routine. Optional AI sends birth year and hometown/spouse/job answers to Anthropic after Generate; those answers can identify a person. A future hospice partner must review clinical oversight, ethics, consent, privacy, security and usability before a patient-facing pilot.

## Public-data evidence, accurately stated

“We audited an existing public TIHM clinical-research label file containing 135 agitation records from 27 participants. These are historical observations from another study, not people who tested Moonrise. We separately trained exploratory research models on it; none met our alert-precision requirement, and none is in the app. The source’s six-hour agitation labels cannot validate our minute-level routine timing.” [Official TIHM dataset](https://zenodo.org/records/7622128), [original label definition](https://www.nature.com/articles/s41597-023-02519-y/tables/5).

Do not describe this as “trained on real patients,” “clinically validated” or “tested in hospice.” The source record includes restrictions on commercial use; a future derived product needs permissions clarified. Acknowledge the TIHM creators and Surrey and Borders Partnership NHS Foundation Trust. No patient-level data is bundled in the app.

## Final validation

See [STATUS.md](STATUS.md) for recorded project checks. Before presenting, verify the exact demo build, live-key AI request, browser/device behavior, offline operation and print pagination. This runbook does not certify those checks.
