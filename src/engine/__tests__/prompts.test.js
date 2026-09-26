import { describe, it, expect } from 'vitest'
import { memoryPrompts, promptAt } from '../prompts.js'

const moonLanding = 'Would you like to talk about the 1969 moon landing?'

describe('memoryPrompts', () => {
  const profile = {
    name: 'Rose',
    birthYear: 1942,
    anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'school teacher' },
  }

  it('builds personal prompts from anchors first', () => {
    const p = memoryPrompts(profile)
    expect(p[0]).toBe('Would you like to talk about Dayton?')
    expect(p).toContain('Would you like to talk about Frank?')
    expect(p.some((s) => s.includes('school teacher'))).toBe(true)
  })

  it('includes the moon landing only for people born before ~1962', () => {
    expect(memoryPrompts({ birthYear: 1942 })).toContain(moonLanding)
    expect(memoryPrompts({ birthYear: 1961 })).toContain(moonLanding)
    expect(memoryPrompts({ birthYear: 1965 })).not.toContain(moonLanding)
  })

  it('skips era events that happened after the reminiscence bump', () => {
    // Born 1920: era ends 1950, so 1969 is well past it.
    expect(memoryPrompts({ birthYear: 1920 })).not.toContain(moonLanding)
  })

  it('uses the teenage decade', () => {
    expect(memoryPrompts({ birthYear: 1942 })).toContain('Would you like to talk about clothes from the 1950s?')
  })

  it('skips blank anchors and still returns general prompts', () => {
    const p = memoryPrompts({ anchors: { hometown: '  ', spouse: '', job: null } })
    expect(p.length).toBeGreaterThan(0)
    expect(p.join(' ')).not.toMatch(/undefined|null|\(\)/)
  })

  it('leads with the current song when given', () => {
    const song = { title: 'Moon River', artist: 'Henry Mancini' }
    expect(memoryPrompts(profile, { song })[0]).toBe('Would you like to talk about "Moon River" by Henry Mancini?')
    expect(memoryPrompts(profile).join(' ')).not.toContain('Moon River')
  })

  it('offers topics without asking for autobiographical recall or assuming an answer', () => {
    const prompts = memoryPrompts(profile, { song: { title: 'Moon River', artist: 'Henry Mancini' } })
    expect(prompts.join(' ')).not.toMatch(/do you remember|where were you|what did you|what was your|who taught you|tell me about|how did you|when you were|where you grew up/i)
    expect(prompts.every(text => /^(Would you like to talk about |We could talk about |We can sit together quietly, too\.)/.test(text))).toBe(true)
    expect(prompts).toContain('We can sit together quietly, too.')
  })

  it('keeps approved wording and the existing trim, order and deduplication behavior', () => {
    const approved = ['  Keep this wording exactly.  ', 'Keep this wording exactly.', 'How did you and Frank meet?', 'How did you and Frank meet?', 'Would you like to talk about Dayton?']
    const original = [...approved]
    const prompts = memoryPrompts(profile, { approved })
    expect(prompts.slice(0, 3)).toEqual([approved[0].trim(), approved[2], approved[4]])
    expect(prompts.filter(text => text.trim() === 'Keep this wording exactly.')).toHaveLength(1)
    expect(prompts.filter(text => text === 'Would you like to talk about Dayton?')).toHaveLength(1)
    expect(approved).toEqual(original)
  })
})

describe('prompt variety', () => {
  it('never repeats a prompt and gives a long session plenty to rotate through', () => {
    const p = memoryPrompts({ birthYear: 1942, anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'nurse' } })
    expect(new Set(p).size).toBe(p.length)
    expect(p.length).toBeGreaterThanOrEqual(20) // 20 x 3 min = an hour without repeating
  })
  it('gates the 1957 satellite prompt by age like other era events', () => {
    const sat = 'We could talk about the first satellite in 1957.'
    expect(memoryPrompts({ birthYear: 1942 })).toContain(sat)
    expect(memoryPrompts({ birthYear: 1952 })).not.toContain(sat)
  })
  it('still works with no profile at all', () => {
    expect(memoryPrompts().length).toBeGreaterThanOrEqual(10)
  })
})

describe('promptAt', () => {
  const prompts = ['a', 'b', 'c']
  it('rotates every 3 minutes by default and wraps', () => {
    expect(promptAt(prompts, 0)).toBe('a')
    expect(promptAt(prompts, 2.9 * 60000)).toBe('a')
    expect(promptAt(prompts, 3 * 60000)).toBe('b')
    expect(promptAt(prompts, 9 * 60000)).toBe('a')
  })
  it('handles empty lists', () => {
    expect(promptAt([], 1000)).toBeNull()
  })
})
