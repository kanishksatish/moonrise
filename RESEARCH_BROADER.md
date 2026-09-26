# Broader training comparison: exploratory results

Completed 2026-09-26T07:33:58.795286+00:00. This fixed comparison completed **200 fits** on one numerical thread using the same previously examined TIHM cohort. It is not an untouched or external confirmation, and no predictor was added to Moonrise.

**The broader search did not produce a supported high-precision alert policy.** The prespecified primary pooled ranking result was lower than the saved comparator, with an uncertain paired difference. No further candidates were fitted after viewing these results.

## Prespecified primary result

The procedure chose a model using inner-fold average precision separately within each outer training partition. Its pooled held-out **average precision was 0.0393** (descriptive 95% participant-bootstrap interval 0.0221–0.0648); **ROC-AUC was 0.7222** (0.6353–0.8215). Average precision measures ranking across thresholds, not the percentage of issued alerts that were correct. ROC-AUC is not accuracy.

Against the saved recent-activity logistic comparator on exactly the same cohort (AP 0.0504), the primary AP difference was -0.0111, with a descriptive paired interval of -0.0563–0.0303. **The selected procedure mixes weighted logistic scores in three folds with unweighted boosting scores in two folds. Their different scales can affect pooled ranking across folds.** Pooled scores are not calibrated patient probabilities. Per-fold results are shown below; no calibration or alternate scoring rule was added after seeing the results.

The cohort remains **50 participants, 8,918 six-hour windows, 128 recorded agitation-label windows and 8,790 unlabelled comparisons**. Twenty-seven participants have recorded labels; prevalence is 1.44%. These windows are not independent clinical episodes. Unlabelled is not confirmed symptom-free.

## Did the strict alert policy qualify?

A cutoff required observed inner precision of at least 50%, at least 10 flags and matched labels from at least three people. The rule was not relaxed. **50 of 50 candidate/fold searches were unsupported; 5 of five outer folds abstained.**

| Secondary policy measure | Held-out result |
|---|---:|
| Flagged windows | 0 |
| Matched recorded-label windows | 0 |
| Missed recorded-label windows | 128 |
| Flagged unlabelled windows | 0 |
| Precision | Undefined (no flags) |
| Recall | 0.00% |
| Eligible windows flagged | 0.00% |
| Distinct flagged / matched people | 0 / 0 |

The precision interval is undefined; the recall interval is 0.0000–0.0000. The bootstrap contained 500 no-flag draws, counted as undefined precision; no-flag draws with recorded labels retain zero recall. If the policy abstains everywhere, a zero-recall interval reflects that decision and provides no evidence of reliability. The 50% threshold rule was a research support constraint, not a clinical standard.

## Every fixed candidate, without selecting an outer-test winner

| Fixed index | Candidate | Outer AP | Outer ROC-AUC |
|---:|---|---:|---:|
| 0 | logistic_C0.03_unweighted | 0.0413 | 0.7763 |
| 1 | logistic_C0.03_balanced | 0.0618 | 0.8118 |
| 2 | logistic_C0.1_unweighted | 0.0505 | 0.7953 |
| 3 | logistic_C0.1_balanced | 0.0640 | 0.8169 |
| 4 | logistic_C1_unweighted | 0.0675 | 0.8159 |
| 5 | logistic_C1_balanced | 0.0640 | 0.8196 |
| 6 | boosting_leaf3_min100 | 0.0663 | 0.8526 |
| 7 | boosting_leaf3_min30 | 0.0668 | 0.8536 |
| 8 | boosting_leaf7_min100 | 0.0660 | 0.8539 |
| 9 | boosting_leaf7_min30 | 0.0668 | 0.8528 |

These comparators do not replace the primary inner-selected procedure. No grid or cutoff changed after inspecting outer performance.

| Outer fold | Primary choice | Inner AP | Primary outer AP | Strict policy |
|---:|---|---:|---:|---|
| 1 | boosting_leaf7_min100 | 0.0785 | 0.1179 | Abstain |
| 2 | logistic_C0.03_balanced | 0.0781 | 0.0137 | Abstain |
| 3 | logistic_C0.03_balanced | 0.0904 | 0.0760 | Abstain |
| 4 | logistic_C0.1_balanced | 0.0718 | 0.0736 | Abstain |
| 5 | boosting_leaf7_min30 | 0.0679 | 0.0938 | Abstain |

## Verification and limits

The protocol was saved before fitting, followed by a hashed pre-fit lock. Nine synthetic checks cover prior-only features, grouped splits, ranking/threshold ties, support, abstention and aggregate privacy. The saved features, cohort and original folds were retained exactly. The results file includes all 50 inner decisions, all candidate/fold metrics, input/code/protocol hashes and dependency versions. All 200 fitted models and individual predictions remain private. The script's `--verify` mode checks saved model predictions and rebuilds aggregates without fitting.

An independent reviewer completed that verification and separate calculations with zero additional fits. Cohort order, inner/outer participant separation, inner-only model selection, all candidate metrics, 50 unsupported cutoffs and all 500 bootstrap summaries matched. All recorded hashes, 200 saved model predictions and 120 logistic scalers were checked against their intended training partitions. Private artifacts were unchanged. This verifies the computation, not clinical validity.

The 500 bootstrap draws resample whole people with multiplicity from fixed predictions. They omit refitting, repeated-development and dataset-shift uncertainty. TIHM's labels can reflect sensor-triggered verification and recording workflow rather than actual onset. Inputs require household sensors and over seven days of prior history absent from Moonrise. The cohort excluded terminal-illness treatment. This study establishes neither clinical alert precision nor hospice suitability or patient benefit. Source notes limit the work to local noncommercial research while commercial rights remain unresolved. [Dataset](https://zenodo.org/records/7622128), [data descriptor](https://pmc.ncbi.nlm.nih.gov/articles/PMC10492790/).

Full protocols, training code, aggregate JSON, hashes and a clinician-led next-study outline are in the local research handoff. Raw records and individual model artifacts remain private and outside this repository.
