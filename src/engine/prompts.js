// Memory prompts for the caregiver to read aloud in Moonrise mode, one at a time.
// Built from the person's anchors (hometown, spouse, job) and their era.
// A caller may supply a song as a conversation topic; it does not imply playback.
// The job anchor should be a role, e.g. "nurse" or "school teacher".
//
// Era events are included only if the person was at least MIN_AGE_AT_EVENT that year
// (so the 1969 moon landing needs a birth year before ~1962).
// Built-ins offer optional topics without asking the person to recall an event.
// Caregiver-approved wording is preserved rather than rewritten here.

import { eraYears } from './songs.js'

export const MIN_AGE_AT_EVENT = 7
export const PROMPT_EVERY_MINUTES = 3

const ERA_EVENTS = [
  { year: 1969, text: 'Would you like to talk about the 1969 moon landing?' },
  { year: 1957, text: 'We could talk about the first satellite in 1957.' },
  { year: 1956, text: 'Would you like to talk about Elvis on the radio?' },
  { year: 1964, text: 'We could talk about the Beatles on television.' },
  { year: 1955, text: 'Would you like to talk about early television shows?' },
]

const GENERAL = [
  'Would you like to talk about music or dancing?',
  'We could talk about a meal you enjoy.',
  'Would you like to talk about friends?',
  'We could talk about summer evenings.',
  'Would you like to talk about the night sky?',
  'We could talk about pets.',
  'Would you like to talk about games?',
  'We could talk about places to spend a Saturday.',
  'Would you like to talk about cooking?',
  'We can sit together quietly, too.',
]

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// profile: { name, birthYear, anchors: { hometown, spouse, job } }
// Returns an array of prompt strings, most personal first.
// `approved`: caregiver-approved prompts (e.g. AI-drafted ones, see ai.js). They come right
// after the song prompt, before the templated ones. Duplicates are removed.
export function memoryPrompts(profile = {}, { song = null, approved = [] } = {}) {
  const prompts = []
  const anchors = profile.anchors ?? {}
  const hometown = clean(anchors.hometown)
  const spouse = clean(anchors.spouse)
  const job = clean(anchors.job)

  if (song) prompts.push(`Would you like to talk about "${song.title}" by ${song.artist}?`)
  for (const text of Array.isArray(approved) ? approved : []) {
    if (typeof text === 'string' && text.trim()) prompts.push(text.trim())
  }

  if (hometown) {
    prompts.push(`Would you like to talk about ${hometown}?`)
    prompts.push(`We could talk about streets and shops in ${hometown}.`)
    prompts.push(`Would you like to talk about evenings in ${hometown}?`)
  }
  if (spouse) {
    prompts.push(`Would you like to talk about ${spouse}?`)
    prompts.push(`We could talk about time with ${spouse}, if you like.`)
  }
  if (job) {
    prompts.push(`Would you like to talk about working as a ${job}?`)
    prompts.push(`We could talk about the work of a ${job}.`)
  }

  if (Number.isInteger(profile.birthYear)) {
    const { to } = eraYears(profile.birthYear)
    const decade = Math.floor((profile.birthYear + 15) / 10) * 10
    prompts.push(`Would you like to talk about clothes from the ${decade}s?`)
    prompts.push(`We could talk about radio music from the ${decade}s.`)
    for (const event of ERA_EVENTS) {
      if (event.year - profile.birthYear >= MIN_AGE_AT_EVENT && event.year <= to + 10) {
        prompts.push(event.text)
      }
    }
  }

  prompts.push(...GENERAL)
  return [...new Set(prompts)]
}

// Which prompt to show after elapsedMs of Moonrise mode, rotating every few minutes.
export function promptAt(prompts, elapsedMs, everyMinutes = PROMPT_EVERY_MINUTES) {
  if (!prompts.length) return null
  const index = Math.floor(Math.max(0, elapsedMs) / (everyMinutes * 60 * 1000))
  return prompts[index % prompts.length]
}
