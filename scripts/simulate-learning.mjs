// Simulation study: does Moonrise's learning actually learn?
//
// Run: node scripts/simulate-learning.mjs
//
// We create synthetic families where the truth is known (which songs really help, when
// episodes really start), let each method learn from simulated evenings, and measure how
// close it gets. Everything is seeded, so the numbers are reproducible. Results are pasted
// into METHODOLOGY.md.
//
// This tests the estimators under stated assumptions; it is not evidence that any song or
// routine helps real people with dementia.

import { seededRandom } from '../src/engine/random.js'

const FAMILIES = 1000

// ---- The alternatives we tried (not used in the app) ----------------------------------
// Smoothed calm rate per song: Beta-style posterior mean with calm = 1, restless = 0.5,
// episode = 0, starting from the family's own weighted calm rate with a weight of 4 evenings.
// Note this is a weighted outcome score, not a probability of a calm evening.
function smoothed(logs) {
  const V = { calm: 1, restless: 0.5, episode: 0 }
  let sum = 0.5
  let n = 1
  const t = {}
  for (const l of logs) {
    sum += V[l.outcome]
    n += 1
    for (const id of new Set(l.songIds)) {
      const x = (t[id] ??= { plays: 0, value: 0 })
      x.plays += 1
      x.value += V[l.outcome]
    }
  }
  const p0 = sum / n
  const k = 4
  return (id) => {
    const x = t[id] ?? { plays: 0, value: 0 }
    const a = k * p0 + x.value
    const b = k * (1 - p0) + x.plays - x.value
    const mean = a / (a + b)
    const sd = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)))
    return { mean, low: mean - 1.645 * sd, p0, plays: x.plays }
  }
}

function normal(rand) {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function pickOutcome(rand, helpfulPlayed) {
  // Base evening: 35% calm, 35% restless, 30% episode. Each truly helpful song opened that
  // evening shifts 12 points from episode (and 6 from restless) toward calm.
  const pCalm = Math.min(0.9, 0.35 + 0.18 * helpfulPlayed)
  const pEpisode = Math.max(0.05, 0.3 - 0.12 * helpfulPlayed)
  const r = rand()
  return r < pCalm ? 'calm' : r < pCalm + pEpisode ? 'episode' : 'restless'
}

// ---- Study 1: finding the helpful songs -----------------------------------------------
const SONGS = 40
const HELPFUL = 3
const NIGHTS = 30
const PER_NIGHT = 3

function rawScore(logs) {
  const s = {}
  for (const l of logs) for (const id of l.songIds) s[id] = (s[id] ?? 0) + (l.outcome === 'calm' ? 1 : l.outcome === 'episode' ? -1 : 0)
  return s
}

const policies = {
  // No learning at all: a fresh random 3 songs each night.
  random: (logs, ids, rand) => shuffle(ids, rand).slice(0, PER_NIGHT),
  // AGENTS.md rule, what Moonrise uses: rank by +1/-1 score, ties shuffled.
  '+1/-1 score (used)': (logs, ids, rand) => {
    const s = rawScore(logs)
    return shuffle(ids, rand).sort((a, b) => (s[b] ?? 0) - (s[a] ?? 0)).slice(0, PER_NIGHT)
  },
  // Tried and rejected: rank by the smoothed calm rate, ties shuffled.
  'smoothed calm rate (rejected)': (logs, ids, rand) => {
    const f = smoothed(logs)
    const rate = (id) => f(id).mean
    return shuffle(ids, rand).sort((a, b) => rate(b) - rate(a)).slice(0, PER_NIGHT)
  },
}

function shuffle(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function songStudy() {
  const rows = []
  for (const [name, policy] of Object.entries(policies)) {
    let calmLate = 0
    let lateNights = 0
    let episodesLate = 0
    const top3At = { 7: 0, 14: 0, 30: 0 }
    let flags = 0
    let flagsRight = 0
    for (let f = 0; f < FAMILIES; f++) {
      const rand = seededRandom(1000 + f) // same families for every policy
      const ids = Array.from({ length: SONGS }, (_, i) => `s${i}`)
      const helpful = new Set(shuffle(ids, rand).slice(0, HELPFUL))
      const policyRand = seededRandom(5000 + f)
      const outcomeRand = seededRandom(9000 + f)
      const logs = []
      for (let n = 1; n <= NIGHTS; n++) {
        const played = policy(logs, ids, policyRand)
        const outcome = pickOutcome(outcomeRand, played.filter((id) => helpful.has(id)).length)
        logs.push({ date: `n${n}`, outcome, songIds: played })
        if (n > 14) {
          lateNights++
          if (outcome === 'calm') calmLate++
          if (outcome === 'episode') episodesLate++
        }
        if (n in top3At) {
          // Precision of the method's current top 3 (what it would suggest next).
          const next = policy(logs, ids, seededRandom(1))
          top3At[n] += next.filter((id) => helpful.has(id)).length / PER_NIGHT
        }
      }
      // Could we label songs as "helpful"? Flag songs whose smoothed range sits wholly above
      // the family's usual rate, and check how many flags are right.
      const sm = smoothed(logs)
      for (const id of ids) {
        const x = sm(id)
        if (x.plays > 0 && x.low > x.p0) {
          flags++
          if (helpful.has(id)) flagsRight++
        }
      }
    }
    rows.push({
      name,
      flagPrecision: flags ? flagsRight / flags : null,
      top7: top3At[7] / FAMILIES,
      top14: top3At[14] / FAMILIES,
      top30: top3At[30] / FAMILIES,
      calmLate: calmLate / lateNights,
      episodeLate: episodesLate / lateNights,
    })
  }
  return rows
}

// ---- Study 2: learning the start time ------------------------------------------------
// Each family has a true typical onset (minutes relative to dusk), uniform in [-70, 0].
// Each episode's onset = typical + noise (sd 15 min), and 10% of episodes are outliers
// (sd 45 min). The ideal lead is -typical + 20. After n timed episodes we compare:
//   median rule (AGENTS.md, used):   lead = median(targets)
//   shrinkage (tried, rejected):     lead = (3 * 45 + n * median) / (3 + n)
// both clamped to 15..90.
function startStudy() {
  const clamp = (x) => Math.min(90, Math.max(15, x))
  const rows = []
  for (const n of [1, 2, 3, 5, 10, 20]) {
    let errMedian = 0
    let errShrink = 0
    for (let f = 0; f < FAMILIES; f++) {
      const rand = seededRandom(20000 + f)
      const typical = -70 * rand()
      const ideal = clamp(-typical + 20)
      const targets = Array.from({ length: n }, () => {
        const sd = rand() < 0.1 ? 45 : 15
        return -(typical + sd * normal(rand)) + 20
      }).sort((a, b) => a - b)
      const med = n % 2 ? targets[(n - 1) / 2] : (targets[n / 2 - 1] + targets[n / 2]) / 2
      errMedian += Math.abs(clamp(med) - ideal)
      errShrink += Math.abs(clamp((3 * 45 + n * med) / (3 + n)) - ideal)
    }
    rows.push({ n, median: errMedian / FAMILIES, shrink: errShrink / FAMILIES })
  }
  return rows
}

const pct = (x) => `${(100 * x).toFixed(1)}%`
const min = (x) => `${x.toFixed(1)} min`

console.log(`## Study 1: finding the songs that help (${FAMILIES} simulated families, ${SONGS} era songs, ${HELPFUL} truly helpful, ${PER_NIGHT} opened per evening)\n`)
console.log('| Method | Helpful songs in its top 3 after 7 evenings | after 14 | after 30 | Calm evenings, nights 15-30 | Episode evenings, nights 15-30 | "Helpful" flags that would be right (night 30) |')
console.log('|---|---|---|---|---|---|---|')
for (const r of songStudy()) {
  const flag = r.flagPrecision === null ? 'n/a' : pct(r.flagPrecision)
  console.log(`| ${r.name} | ${pct(r.top7)} | ${pct(r.top14)} | ${pct(r.top30)} | ${pct(r.calmLate)} | ${pct(r.episodeLate)} | ${flag} |`)
}
console.log(`\n(Chance level for "a song in the top 3 is truly helpful": ${pct(HELPFUL / SONGS)}.)`)
console.log(`\n## Study 2: learning the start time (${FAMILIES} simulated families per row)\n`)
console.log('| Timed episodes logged | Median rule (used): average error | Shrinkage toward 45 min (rejected): average error |')
console.log('|---|---|---|')
for (const r of startStudy()) {
  console.log(`| ${r.n} | ${min(r.median)} | ${min(r.shrink)} |`)
}
