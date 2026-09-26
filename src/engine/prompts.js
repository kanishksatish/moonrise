// Memory prompts for the caregiver to read aloud in Moonrise mode, one at a time.
// Built from the person's anchors (hometown, spouse, job), their era, and the current song.
// The job anchor should be a role, e.g. "nurse" or "school teacher".
//
// Era events are included only if the person was at least MIN_AGE_AT_EVENT that year
// (so the 1969 moon landing needs a birth year before ~1962).
// Prompts are gentle and open-ended on purpose: no quizzes, nothing with a wrong answer.

import { eraYears } from './songs.js'

export const MIN_AGE_AT_EVENT = 7
export const PROMPT_EVERY_MINUTES = 3

const ERA_EVENTS = [
  { year: 1969, text: 'Where were you when they landed on the moon in 1969?' },
  { year: 1956, text: 'Do you remember the first time you heard Elvis on the radio?' },
  { year: 1964, text: 'Do you remember when the Beatles first came on television?' },
  { year: 1955, text: 'What was the first thing you remember watching on television?' },
]

const GENERAL = [
  'What songs did you love to dance to?',
  'What was your favorite meal when you were young?',
  'Tell me about your best friend growing up.',
  'What did you do on summer evenings when you were young?',
]

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// profile: { name, birthYear, anchors: { hometown, spouse, job } }
// Returns an array of prompt strings, most personal first.
export function memoryPrompts(profile = {}, { song = null } = {}) {
  const prompts = []
  const anchors = profile.anchors ?? {}
  const hometown = clean(anchors.hometown)
  const spouse = clean(anchors.spouse)
  const job = clean(anchors.job)

  if (song) prompts.push(`Do you remember "${song.title}" by ${song.artist}?`)

  if (hometown) {
    prompts.push(`Tell me about ${hometown} when you were young.`)
    prompts.push(`What was your street like in ${hometown}?`)
  }
  if (spouse) {
    prompts.push(`How did you and ${spouse} meet?`)
    prompts.push(`Where did you and ${spouse} like to go together?`)
  }
  if (job) {
    prompts.push(`Tell me about your days as a ${job}.`)
    prompts.push(`What was a good day at work like, back when you were a ${job}?`)
  }

  if (Number.isInteger(profile.birthYear)) {
    const { to } = eraYears(profile.birthYear)
    const decade = Math.floor((profile.birthYear + 15) / 10) * 10
    prompts.push(`What did you wear to go out in the ${decade}s?`)
    for (const event of ERA_EVENTS) {
      if (event.year - profile.birthYear >= MIN_AGE_AT_EVENT && event.year <= to + 10) {
        prompts.push(event.text)
      }
    }
  }

  prompts.push(...GENERAL)
  return prompts
}

// Which prompt to show after elapsedMs of Moonrise mode, rotating every few minutes.
export function promptAt(prompts, elapsedMs, everyMinutes = PROMPT_EVERY_MINUTES) {
  if (!prompts.length) return null
  const index = Math.floor(Math.max(0, elapsedMs) / (everyMinutes * 60 * 1000))
  return prompts[index % prompts.length]
}
