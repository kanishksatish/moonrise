# Moonrise research results: completed training and its limits

**We trained models on real public dementia-monitoring data. Comparing a person's recent activity with their own earlier activity modestly improved event ranking. Reliable predictive alerts remain unsupported.**

Latest update: a broader, fixed **200-fit comparison** also failed to find a supported high-precision alert policy. The earlier feature improvement is retained below, alongside the less favorable later result. More tuning did not establish clinical reliability.

The source is the [official TIHM dataset](https://zenodo.org/records/7622128), with 1,030,559 household activity-sensor records from 56 participants. These are sensor records, not a million patients. The personal-baseline and broader experiments required additional earlier history, retaining 50 participants and 8,918 six-hour windows, including 128 windows with a recorded agitation label. Participants were separated between training and evaluation; model and cutoff selection used only inner training folds.

## What improved

The earlier personal-baseline experiment completed 60 model fits across three fixed candidates and nested validation. It compared the same eligible cohort throughout:

| Candidate | Average precision | Descriptive 95% interval |
|---|---:|---:|
| Recent activity, logistic regression | 0.0504 | 0.0217–0.1047 |
| Personal baseline, logistic regression | 0.0640 | 0.0276–0.1268 |
| Personal baseline, gradient boosting | 0.0668 | 0.0376–0.1063 |

The prespecified personal-versus-recent logistic comparison improved by **0.0137 average-precision units**, with a descriptive paired interval of **0.0025–0.0278**. Average precision summarizes ranking across cutoffs; it is not the percentage of alerts that were correct. These intervals resample whole participants from fixed predictions and do not include model refitting or uncertainty from repeated development on this dataset.

## The broader tuning pass

After the first feature comparison, we fixed ten candidates: six logistic models varying regularization and class weights, and four gradient-boosting configurations. Three inner folds within each of five participant-separated outer folds produced 150 inner fits and 50 outer fits. Model selection used inner results only; every candidate is reported in the [broader findings](RESEARCH_BROADER.md).

The primary inner-selected procedure had pooled AP **0.0393** (descriptive 95% interval **0.0221–0.0648**), versus **0.0504** for the saved recent-activity comparator on the same cohort. Its paired difference was **−0.0111**, with interval **−0.0563 to +0.0303**. Selected weighted-logistic and unweighted-boosting models have different score scales, which can distort pooled ranking; the full report therefore also shows results for each fold. No post-hoc calibration or outer-test winner replaced the prespecified procedure.

**All 50 candidate-by-fold strict cutoff searches failed the support requirements.** The policy still abstained in all five folds. Training stopped after the fixed pass; no candidates or requirements were altered after seeing the results. The dataset has been examined repeatedly, so this is exploratory development rather than an independent confirmation.

## What did not work

The fixed selection rule required at least 50% observed precision, at least 10 flags, and matched recorded labels from at least three participants. **None of the candidates qualified in any outer fold in either pass.** The selected policies abstained: zero flags, all 128 labels missed, zero recall and undefined precision. This requirement was a research support rule, not a clinical standard.

A subsequent diagnostic tested lower alert cutoffs without retraining or choosing cutoffs from held-out labels. All six fixed settings are shown below. They are exploratory failure analysis and do not replace the original result.

| Model | Nominal inner workload | Actual held-out workload | Flags | Matched labels | Recorded-label precision | Recorded-label recall |
|---|---:|---:|---:|---:|---:|---:|
| Recent activity | 1% | 0.33% | 29 | 0 | 0% | 0% |
| Recent activity | 5% | 3.73% | 333 | 18 | 5.41% | 14.06% |
| Recent activity | 10% | 8.68% | 774 | 56 | 7.24% | 43.75% |
| Personal baseline | 1% | 0.16% | 14 | 0 | 0% | 0% |
| Personal baseline | 5% | 2.48% | 221 | 20 | 9.05% | 15.62% |
| Personal baseline | 10% | 7.57% | 675 | 54 | 8.00% | 42.19% |

For example, the personal-baseline 5% setting produced 201 flagged windows without a recorded label and missed 108 of 128 labelled windows. Unlabelled windows are not confirmed clinical negatives, so these counts cannot establish clinical false-positive rates. The gap between nominal and actual workload also shows that score cutoffs did not transfer reliably between training and held-out participants. This is not a validated alert system.

## What we can say in the presentation

“We trained and evaluated models on public dementia-monitoring data, keeping participants separate between training and testing. Personal baselines modestly improved recorded-event ranking, but alert precision remained insufficient. We kept this research model outside Moonrise while building a practical caregiver routine, music and logging tool. Moonrise has not been tested with patients.”

## The next step toward stronger evidence

More repeated tuning of these same records would not provide an independent test. The next predictive study needs a clinician-defined outcome and horizon, reliable event and observation labels, inputs the intended app actually collects, and a locked evaluation on new participants. Report precision alongside missed events, alert burden, coverage and uncertainty. Separately, representative caregivers can test the current prototype's usability with fictional scenarios; that would measure usability, not clinical benefit.

The TIHM source cohort and household sensors do not establish hospice applicability. The app does not collect these sensors or the required 174 hours of history. The source's noncommercial-use notes also leave deployment rights unresolved. Connecting OpenAI generates reviewable conversation drafts; it does not train this predictor or validate a clinical claim.

Acknowledgement: TIHM creators, Surrey and Borders Partnership NHS Foundation Trust, and Howz. No endorsement or partnership is implied. [Official dataset and terms](https://zenodo.org/records/7622128); [original data descriptor](https://www.nature.com/articles/s41597-023-02519-y).

## Reproducibility and access

The local research handoff contains the fixed protocols, training code, aggregate results and hashes, independent verification, all six workload diagnostics, and a visual summary. Private participant records, individual predictions and fitted models are kept outside the app repository. The latest broader comparison performed 200 additional fits; the workload analysis and summary figure did not fit models.

Prepared September 26, 2026. See [METHODOLOGY.md](METHODOLOGY.md) for the separate rules that run in Moonrise.
