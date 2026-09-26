# How Moonrise adapts (and what we checked)

Moonrise adapts to one family using nothing but that family's own logged evenings, the real
sky and the weather forecast. The same logs always give the same numbers. The only
randomness is the order of equally ranked songs, and the clearly labelled demo week, which
uses a fixed seed.

It is caregiver support, not a medical tool.

## Evidence boundary

- **No TIHM-trained predictive model is used in the app, and nothing has been clinically validated.** No patient
  testing, no clinician involvement, no clinical data in this repository.
- **Why the app uses transparent timing rules.** A family produces roughly 7 to 30 logged evenings, far too little to
  train a model, and claiming one would be misleading. The team also looked for public data
  to learn onset times from. Codex audited the public TIHM dataset's `Labels.csv` locally:
  608 records from 49 participants, 135 agitation labels from 27 participants. Those labels
  cover six-hour windows, not minute-level onset times, and the licence notes restrict
  commercial use. So nothing in the app was trained on it, and no raw or derived participant
  records are in this repository.
- **Separate public-data research benchmark (not part of the app).** Later, the team trained
  a research model on TIHM activity-sensor features to predict whether a six-hour window had a
  recorded agitation label (133 labelled windows among 10,330, from 56 participants), tested on
  participants held out from training (five participant-separated folds). Logistic regression
  reached an average precision of 0.047 (descriptive 95% participant-bootstrap interval
  0.019–0.094; ROC-AUC 0.80), against 0.027 for a clock-only baseline; the interval for the
  difference includes zero. At the prespecified threshold, 3.7% of flagged windows matched a
  recorded label. An exploratory follow-up selected model and threshold using only inner
  participant-separated validation: at least 50% precision, at least 10 flags, and matched
  labels from at least 3 participants. Neither candidate met all requirements in any of
  the five outer training partitions. The policy abstained throughout: precision was
  undefined and recall was zero. No TIHM predictor is connected to Moonrise. Optional
  caregiver-reviewed conversation prompts use a separate pretrained language model. These are proxy metrics against recorded labels, not
  clinical performance.
- **Personal-baseline follow-up, same-cohort comparison.** A further exploratory experiment
  compared recent activity with each person's own earlier six days, retaining 50 participants
  and 8,918 windows (128 recorded agitation-label windows). It used three fixed candidates,
  five participant-separated outer folds and three inner folds, with 60 model fits. On that
  identical reduced cohort, average precision was 0.0504 for recent-activity logistic regression,
  0.0640 for personal-baseline logistic regression and 0.0668 for personal-baseline gradient
  boosting. The prespecified paired logistic improvement was 0.0137 (descriptive 95%
  participant-bootstrap interval 0.0025–0.0278). This is modest ranking improvement, not alert
  accuracy; the interval uses fixed predictions and omits refitting and repeated-development
  uncertainty. None of the three candidates met the same fixed precision/support requirements
  in any outer fold. The selected policy still abstained, missing all 128 recorded labels.
  A later diagnostic of six fixed, lower workload cutoffs did not retrain or tune on held-out
  labels: personal-baseline nominal 5% inner workload transferred to 2.48% held-out workload,
  with 20 of 221 flags matching labels (9.05% recorded-label precision, 15.62% recall). All settings
  and limitations are in [RESEARCH_RESULTS.md](RESEARCH_RESULTS.md). Unlabelled windows are not
  confirmed negatives. Household sensors and 174 hours of history are absent from Moonrise;
  no predictor was integrated, and there is no independent patient or hospice validation.
- **What the simulations do and don't show.** They check that the rules behave sensibly on
  synthetic data built from our stated assumptions. They say nothing about real people.

## The rules the app uses

**Suggested start time** (from AGENTS.md). Onset = when an episode began, minus that
evening's estimated dusk. After 3+ logged evenings with at least one timed episode:
`start = estimated dusk + median(onsets) − 20 minutes`, kept between 90 and 15 minutes before
dusk. Before that it is 45 minutes before dusk. Once several episodes are logged, the
median keeps a single unusual night from pulling the time far; with only one or two timed
episodes, one night can still move it a lot.

**Song ranking** (from AGENTS.md). Score = +1 for each calm evening a song was recorded as
played, −1 for each episode evening, 0 for restless. A catalog song is recorded only when the
in-app player reports it actually playing. The legacy era catalog retains its score-based
ordering, but no unverified YouTube title is offered as a playable source. The included
listening library has separate immutable bundled IDs: actual playback is logged and its
metadata is available to the weekly report. The included picker is not personalized or
ranked by the era-song engine. Personal files are not assigned a catalog ID; historical
piano or file playback is never inferred.

**Song evidence, as plain counts** (engine support). For example: "Played in the app on 5
logged evenings: 3 calm, 1 restless, 1 episode." This is not a probability, a rating or a
claim that a song helps. Several things happen on the same evening, repeated evenings aren't
independent, and a song playing doesn't mean the person was listening.

**Progress milestones (light, process-only gamification).**
- First evening logged.
- First song played in the app.
- Start time based on your logs (3 evenings including a timed episode).
- A week of evenings recorded.

They mark steps in *using* Moonrise. They never reward a calm evening or a particular song,
there are no streaks to lose, nothing scores the person with dementia, and an episode
evening counts exactly like any other. A milestone reached only because of demo evenings is
marked as demo.

## What we tried and why we didn't use it

We built a "smarter" alternative to each rule and compared them on seeded simulated families.
Run `node scripts/simulate-learning.mjs` (about 1 second) to reproduce the tables below.

### Study 1: ranking songs

1,000 simulated families. Each has 40 era songs, 3 of which are secretly "helpful", and 3
songs are opened each evening. A normal evening is 35% calm, 35% restless and 30% episode.
Each helpful song opened that evening shifts it toward calm (+18 points calm, −12 episode).

| Method | Helpful songs in its top 3 after 7 evenings | after 14 | after 30 | Calm evenings, nights 15–30 | Episode evenings, nights 15–30 | "Helpful" flags that would be right (night 30) |
|---|---|---|---|---|---|---|
| random (no learning) | 7.3% | 7.3% | 7.3% | 38.9% | 27.5% | 48.3% |
| **+1/−1 score (used)** | **12.2%** | **14.7%** | **18.4%** | **44.0%** | **24.1%** | 38.8% |
| smoothed calm rate (rejected) | 11.6% | 12.2% | 12.7% | 41.9% | 25.5% | 41.7% |

Chance level for a song in the top 3 being truly helpful is 7.5%.

- **The simple score did best** at what matters in this simulation: calm evenings on nights
  15–30. The smoothed alternative was a Beta-style average with calm = 1, restless = 0.5 and
  episode = 0 (an arbitrary weighting, so a score rather than a probability). It was more
  cautious and did worse, so it isn't used.
- **Why the app doesn't label songs "helpful".** If we flagged songs whose smoothed range sat
  above the family's usual evenings, only about 40% of flags would be right in this
  simulation. That's above chance, but most would be wrong, because songs share each
  evening's outcome. So the app shows counts and makes no claims.

### Study 2: learning the start time

1,000 simulated families per row. Each has a true typical onset, uniform between 70 minutes
before dusk and dusk itself. Each episode's onset varies by 15 minutes (standard
deviation), and 10% are outliers with 45 minutes of spread. The ideal start is 20 minutes
before the typical onset. The alternative "shrinks" the estimate toward the 45-minute
default, as if the default were worth 3 evenings.

| Timed episodes logged | Median rule (used): average error | Shrinkage toward 45 min (rejected): average error |
|---|---|---|
| 1 | 11.8 min | 14.4 min |
| 2 | 9.2 min | 11.9 min |
| 3 | 8.0 min | 10.0 min |
| 5 | 6.5 min | 8.0 min |
| 10 | 4.7 min | 5.6 min |
| 20 | 3.3 min | 3.8 min |

The median rule from the original brief was more accurate at every sample size, so it stays.
We also experimented with showing an uncertainty range around the start time. Its coverage
depends entirely on the simulated assumptions and isn't calibrated clinical uncertainty, so
the app doesn't show one.

## Other limits

- Estimated dusk is a prototype rule (sunset shifted earlier by forecast cloud cover), not a
  measured light level.
- Everything above describes one family's own logs. Nothing generalises to other people.
