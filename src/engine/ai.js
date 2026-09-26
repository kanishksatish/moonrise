// AI-written memory prompts (optional, caregiver-reviewed).
//
// Claude drafts a few gentle, personal memory prompts from the person's era and memory
// anchors. The caregiver reads them and approves the ones they like; only approved prompts
// ever appear in Moonrise mode (see memoryPrompts in prompts.js). Nothing is sent unless the
// caregiver taps "Generate" with their own Anthropic API key.
//
// Privacy: we send the birth year, era years, and the three optional anchor answers
// (hometown, spouse's first name, job) exactly as typed. We never send the profile name,
// the saved coordinates/city, or any evening logs. (An anchor answer can itself contain a
// name or place; that is the caregiver's choice, and the Settings note says so.)
//
// The key: there is no Moonrise server, so the browser calls the Anthropic API directly
// with a key the caregiver pastes into Settings (stored only on this device, apart from the
// app data, see storage.js). This is fine for a prototype/demo; a real release would route
// through a small server that holds the key.
//
// The Anthropic SDK is loaded only when prompts are generated, so it is not part of the
// app's startup bundle or offline shell.

import { eraYears } from './songs.js'

// Haiku 4.5: fast and inexpensive, plenty for six short prompts that a caregiver reviews.
export const AI_MODEL = 'claude-haiku-4-5'
export const AI_PROMPT_COUNT = 6
export const AI_TIMEOUT_MS = 30000
// Six prompts of under 20 words fit in a few hundred tokens; this leaves plenty of room
// while bounding cost if a reply ever runs long.
export const AI_MAX_TOKENS = 2048
const MAX_PROMPT_LENGTH = 140

// Topics a caregiver would not want surfacing unprompted in a calming evening routine.
// Claude is told to avoid them; this is a second line of defence before caregiver review.
const AVOID = /\b(died|death|dead|passed away|funeral|grave|war|bomb|hospital|illness|sick|divorce|lost (your|her|his)|miss(ing)? (him|her))\b/i

const SYSTEM = `You write memory prompts for a family caregiver to read aloud to an older adult living with dementia, during a calm evening routine.

Write short, warm, open-ended invitations to reminisce, drawn from the person's youth (their late childhood to about age 30) and the details provided.
- One idea per prompt, under 20 words, plain everyday language, ending with "?" or ".".
- Open-ended: no quizzes, no right or wrong answers, never test memory ("Do you remember what year...").
- Gentle and positive: sensory details, music, places, everyday life, small pleasures.
- Avoid anything likely to upset: loss, death, illness, war, conflict, hospitals, money worries, divorce. Do not assume the spouse is alive or the marriage was happy; keep spouse prompts light (how they met, a favourite outing).
- Use the details given; do not invent specific facts about the person.`

export class AiPromptError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AiPromptError'
    // no_key | bad_key | rate_limited | offline | refused | bad_output | service
    this.code = code
  }
}

// Only the details Claude needs. Blank anchors are left out entirely.
export function promptDetails(profile = {}) {
  const details = {}
  if (Number.isInteger(profile.birthYear)) {
    const { from, to } = eraYears(profile.birthYear)
    details.birthYear = profile.birthYear
    details.youthYears = `${from} to ${to}`
  }
  const anchors = profile.anchors ?? {}
  for (const key of ['hometown', 'spouse', 'job']) {
    const value = typeof anchors[key] === 'string' ? anchors[key].trim() : ''
    if (value) details[key] = value
  }
  return details
}

export function buildRequestText(profile, count = AI_PROMPT_COUNT) {
  const d = promptDetails(profile)
  const lines = [
    d.birthYear ? `Born: ${d.birthYear} (youth roughly ${d.youthYears})` : 'Birth year: not given',
    `Hometown: ${d.hometown ?? 'not given'}`,
    `Spouse's first name: ${d.spouse ?? 'not given'}`,
    `Work: ${d.job ?? 'not given'}`,
  ]
  return `Details:\n${lines.join('\n')}\n\nWrite ${count} different prompts.`
}

// Tidy what came back: trim, drop empties, over-long or upsetting ones, and duplicates.
export function cleanGeneratedPrompts(prompts, existing = []) {
  const seen = new Set(existing.map((p) => p.trim().toLowerCase()))
  const out = []
  for (const raw of Array.isArray(prompts) ? prompts : []) {
    if (typeof raw !== 'string') continue
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text || text.length > MAX_PROMPT_LENGTH || AVOID.test(text)) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

const OFFLINE_MESSAGE = 'Could not reach the AI service. Check the connection and try again.'

// The SDK and its helpers are separate chunks loaded on first use. If that load fails
// (e.g. offline before they were ever cached), report it as offline rather than letting a
// raw import error escape.
async function loadModules() {
  try {
    const [{ default: Anthropic }, { z }, { zodOutputFormat }] = await Promise.all([
      import('@anthropic-ai/sdk'),
      import('zod'),
      import('@anthropic-ai/sdk/helpers/zod'),
    ])
    return { Anthropic, z, zodOutputFormat }
  } catch {
    throw new AiPromptError('offline', OFFLINE_MESSAGE)
  }
}

// Map errors to the few cases the caregiver can act on. `Anthropic` is the already-loaded
// SDK (or null if loading it is what failed), so this never imports anything itself.
function toAiError(err, Anthropic) {
  if (err instanceof AiPromptError) return err
  const status = typeof err?.status === 'number' ? err.status : null
  if (status === 401 || status === 403) {
    return new AiPromptError('bad_key', 'That API key was not accepted. Check it in Settings.')
  }
  if (status === 429) {
    return new AiPromptError('rate_limited', 'Too many requests right now. Try again in a minute.')
  }
  if (Anthropic && err instanceof Anthropic.APIConnectionError) {
    return new AiPromptError('offline', OFFLINE_MESSAGE)
  }
  return new AiPromptError('service', 'The AI service had a problem. Try again later.')
}

// Returns up to `count` new prompt strings for the caregiver to review.
// Rejects with an AiPromptError whose .code tells the UI what to say.
// Pass `client` (anything with messages.parse) to test without the network.
export async function generateMemoryPrompts(profile, { apiKey, client, existing = [], count = AI_PROMPT_COUNT } = {}) {
  if (!client && !(typeof apiKey === 'string' && apiKey.trim())) {
    throw new AiPromptError('no_key', 'Add an Anthropic API key in Settings to use AI prompts.')
  }
  let Anthropic = null
  try {
    const modules = await loadModules()
    Anthropic = modules.Anthropic
    const { z, zodOutputFormat } = modules
    const api =
      client ?? new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: AI_TIMEOUT_MS })
    const Schema = z.object({ prompts: z.array(z.string()) })

    // Haiku 4.5 takes no effort setting; structured output keeps the reply as { prompts: [...] }.
    const response = await api.messages.parse({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      output_config: { format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: buildRequestText(profile, count) }],
    })

    if (response.stop_reason === 'refusal') {
      throw new AiPromptError('refused', 'The AI declined this request. You can keep using the built-in prompts.')
    }
    if (!response.parsed_output) {
      throw new AiPromptError('bad_output', 'The AI reply could not be read. Try again.')
    }
    return cleanGeneratedPrompts(response.parsed_output.prompts, existing).slice(0, count)
  } catch (err) {
    throw toAiError(err, Anthropic)
  }
}
