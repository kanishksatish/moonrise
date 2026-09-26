import { AiPromptError } from '../engine/index.js'

const MESSAGES = {
  no_key: 'Connect an OpenAI key on this laptop, then try again.',
  bad_key: 'OpenAI did not accept this key. Replace it on the local connection page.',
  rate_limited: 'The request limit was reached. Wait a minute, or check your OpenAI API billing and limits.',
  busy: 'A prompt request is already running. Wait for it to finish.',
  invalid_profile: 'Check your birth year and keep each optional memory answer under 160 characters.',
  refused: 'The AI declined this request. Your built-in prompts are still available.',
  bad_output: 'The AI reply could not be used. Your built-in prompts are still available.',
  timeout: 'The request took too long. Your built-in prompts still work; try again later.',
}
export function isLocalAiOrigin(location = globalThis.location) {
  return location?.protocol === 'http:' && location?.hostname === '127.0.0.1'
}
async function call(route, body, fetchImpl = globalThis.fetch) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), route === 'generate' ? 35000 : 2500)
  try {
    const response = await fetchImpl(`/__moonrise/ai/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moonrise-Client': '1' },
      body: JSON.stringify(body), cache: 'no-store', signal: controller.signal,
    })
    const data = await response.json()
    if (!response.ok) throw new AiPromptError(data.error || 'service', MESSAGES[data.error] || 'The local AI connection had a problem. Built-in prompts still work.')
    return data
  } catch (error) {
    if (error instanceof AiPromptError) throw error
    throw new AiPromptError('offline', 'The local AI server could not be reached. Keep it running on this laptop, or use built-in prompts.')
  } finally { clearTimeout(timeout) }
}
export async function localAiStatus({ location = globalThis.location, fetchImpl } = {}) {
  if (!isLocalAiOrigin(location)) return null
  try {
    const data = await call('status', {}, fetchImpl)
    return data.gateway === 'moonrise-local-openai-v1' && typeof data.configured === 'boolean' ? { configured: data.configured } : null
  } catch { return null }
}
export async function generateLocalPrompts(profile, { existing = [], fetchImpl } = {}) {
  // An explicit allowlist is applied here and independently on the server.
  const selected = { birthYear: profile.birthYear, anchors: {} }
  for (const field of ['hometown', 'spouse', 'job']) {
    if (typeof profile.anchors?.[field] === 'string') selected.anchors[field] = profile.anchors[field]
  }
  const data = await call('generate', { profile: selected }, fetchImpl)
  if (!Array.isArray(data.prompts) || data.prompts.length > 6 || !data.prompts.every(item => typeof item === 'string')) throw new AiPromptError('bad_output', MESSAGES.bad_output)
  const seen = new Set(existing.map(text => text.trim().toLowerCase()))
  return data.prompts.filter(text => {
    const id = text.trim().toLowerCase()
    if (!id || text.length > 140 || seen.has(id)) return false
    seen.add(id)
    return true
  })
}
