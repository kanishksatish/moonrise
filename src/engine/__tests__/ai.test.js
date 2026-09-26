import { describe, it, expect, vi } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import {
  AI_MODEL,
  AiPromptError,
  buildRequestText,
  cleanGeneratedPrompts,
  generateMemoryPrompts,
  promptDetails,
} from '../ai.js'
import { memoryPrompts } from '../prompts.js'
import { loadAiKey, saveAiKey, clearAiKey, loadState, STORAGE_KEY } from '../storage.js'

const profile = {
  name: 'Rose Example',
  birthYear: 1942,
  lat: 51.5,
  lon: -0.12,
  city: 'London',
  anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'school teacher' },
}

// A stand-in for the SDK client: records the request, returns what we tell it to.
function fakeClient(reply) {
  const calls = []
  return {
    calls,
    messages: {
      parse: async (params) => {
        calls.push(params)
        if (reply instanceof Error) throw reply
        return reply
      },
    },
  }
}
const ok = (prompts) => ({ stop_reason: 'end_turn', parsed_output: { prompts }, content: [] })

describe('what gets sent', () => {
  it('sends only birth year, era and non-blank anchors, never the name or location', () => {
    expect(promptDetails(profile)).toEqual({
      birthYear: 1942,
      youthYears: '1952 to 1972',
      hometown: 'Dayton',
      spouse: 'Frank',
      job: 'school teacher',
    })
    const text = buildRequestText(profile)
    expect(text).not.toMatch(/Rose|London|51\.5/)
    expect(promptDetails({ birthYear: 1942, anchors: { hometown: '  ', spouse: '', job: null } })).toEqual({
      birthYear: 1942,
      youthYears: '1952 to 1972',
    })
  })

  it('makes one structured-output request with the documented shape', async () => {
    const client = fakeClient(ok(['Tell me about the river in Dayton.']))
    await generateMemoryPrompts(profile, { client })
    const [req] = client.calls
    expect(req.model).toBe('claude-haiku-4-5')
    expect(req.max_tokens).toBe(2048)
    expect(AI_MODEL).toBe('claude-haiku-4-5')
    expect(req.output_config.format).toBeTruthy()
    // Haiku 4.5 rejects these; make sure they never creep back in.
    expect(req.output_config.effort).toBeUndefined()
    expect(req.thinking).toBeUndefined()
    expect(req.fallbacks).toBeUndefined()
    expect(req.betas).toBeUndefined()
    expect(req.messages).toHaveLength(1)
    expect(req.messages[0].content).toContain('Dayton')
    expect(req.messages[0].content).not.toContain('Rose')
  })
})

describe('results', () => {
  it('returns cleaned prompts, skipping ones already approved', async () => {
    const client = fakeClient(
      ok([
        '  Tell me about   the river in Dayton. ',
        'What songs played at school dances?',
        'what songs played at school dances?',
        'Tell me about the day your father died.',
        '',
        42,
        'x'.repeat(200),
        'How did you and Frank meet?',
      ])
    )
    const prompts = await generateMemoryPrompts(profile, { client, existing: ['How did you and Frank meet?'] })
    expect(prompts).toEqual(['Tell me about the river in Dayton.', 'What songs played at school dances?'])
  })

  it('caps the number of prompts', async () => {
    const many = Array.from({ length: 10 }, (_, i) => `Prompt number ${i}?`)
    expect(await generateMemoryPrompts(profile, { client: fakeClient(ok(many)), count: 3 })).toHaveLength(3)
  })

  it('filters upsetting topics as a backstop to caregiver review', () => {
    expect(cleanGeneratedPrompts(['Where did you go during the war?', 'What was the hospital like?', 'What did you plant in your garden?'])).toEqual([
      'What did you plant in your garden?',
    ])
  })
})

describe('errors the caregiver can act on', () => {
  const codeOf = async (promise) => {
    try {
      await promise
      return 'resolved'
    } catch (e) {
      expect(e).toBeInstanceOf(AiPromptError)
      return e.code
    }
  }

  it('asks for a key before calling anything', async () => {
    expect(await codeOf(generateMemoryPrompts(profile, {}))).toBe('no_key')
    expect(await codeOf(generateMemoryPrompts(profile, { apiKey: '   ' }))).toBe('no_key')
  })
  it('reports a refusal instead of reading content', async () => {
    const refused = { stop_reason: 'refusal', stop_details: { category: null }, parsed_output: null, content: [] }
    expect(await codeOf(generateMemoryPrompts(profile, { client: fakeClient(refused) }))).toBe('refused')
  })
  it('reports unreadable output', async () => {
    const bad = { stop_reason: 'end_turn', parsed_output: null, content: [] }
    expect(await codeOf(generateMemoryPrompts(profile, { client: fakeClient(bad) }))).toBe('bad_output')
  })
  it('maps SDK error classes', async () => {
    const h = new Headers()
    const cases = [
      [new Anthropic.AuthenticationError(401, { type: 'error' }, 'invalid x-api-key', h), 'bad_key'],
      [new Anthropic.PermissionDeniedError(403, { type: 'error' }, 'forbidden', h), 'bad_key'],
      [new Anthropic.RateLimitError(429, { type: 'error' }, 'slow down', h), 'rate_limited'],
      [new Anthropic.APIConnectionError({ message: 'offline' }), 'offline'],
      [new Anthropic.APIConnectionTimeoutError(), 'offline'],
      [new Anthropic.InternalServerError(500, { type: 'error' }, 'oops', h), 'service'],
      [new Error('anything else'), 'service'],
    ]
    for (const [err, code] of cases) {
      expect(await codeOf(generateMemoryPrompts(profile, { client: fakeClient(err) }))).toBe(code)
    }
  })
})

describe('SDK chunk unavailable (first use while offline)', () => {
  it('rejects with an offline AiPromptError instead of a raw import error', async () => {
    vi.resetModules()
    vi.doMock('@anthropic-ai/sdk', () => {
      throw new TypeError('Failed to fetch dynamically imported module')
    })
    try {
      const fresh = await import('../ai.js')
      const err = await fresh.generateMemoryPrompts(profile, { apiKey: 'sk-ant-x' }).catch((e) => e)
      expect(err).toBeInstanceOf(fresh.AiPromptError)
      expect(err.code).toBe('offline')
    } finally {
      vi.doUnmock('@anthropic-ai/sdk')
      vi.resetModules()
    }
  })
})

describe('approved prompts in Moonrise mode', () => {
  it('come right after the song prompt, without duplicates', () => {
    const song = { title: 'Moon River', artist: 'Henry Mancini' }
    const p = memoryPrompts(profile, { song, approved: ['Tell me about the river in Dayton.', '  ', 7, 'How did you and Frank meet?'] })
    expect(p.slice(0, 3)).toEqual([
      'Do you remember "Moon River" by Henry Mancini?',
      'Tell me about the river in Dayton.',
      'How did you and Frank meet?',
    ])
    expect(p.filter((x) => x === 'How did you and Frank meet?')).toHaveLength(1)
  })
  it('are unchanged when none are approved', () => {
    expect(memoryPrompts(profile)).toEqual(memoryPrompts(profile, { approved: [] }))
  })
})

describe('storage', () => {
  function memoryStorage() {
    const data = {}
    return {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => (data[k] = String(v)),
      removeItem: (k) => delete data[k],
      data,
    }
  }
  it('keeps the API key apart from app state', () => {
    const s = memoryStorage()
    expect(loadAiKey(s)).toBe('')
    expect(saveAiKey('  sk-ant-test  ', s)).toBe(true)
    expect(loadAiKey(s)).toBe('sk-ant-test')
    expect(s.data[STORAGE_KEY]).toBeUndefined()
    clearAiKey(s)
    expect(loadAiKey(s)).toBe('')
  })
  it('never throws when storage is blocked', () => {
    const blocked = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
    expect(loadAiKey(blocked)).toBe('')
    expect(saveAiKey('k', blocked)).toBe(false)
  })
  it('cleans approved prompts on load', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, JSON.stringify({ profile, logs: [], approvedPrompts: ['Keep me.', '', 3, null] }))
    expect(loadState(s).approvedPrompts).toEqual(['Keep me.'])
    s.setItem(STORAGE_KEY, JSON.stringify({ profile, logs: [], approvedPrompts: 'nope' }))
    expect(loadState(s).approvedPrompts).toEqual([])
  })
})
