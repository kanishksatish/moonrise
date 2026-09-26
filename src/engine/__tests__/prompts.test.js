import { describe, it, expect } from 'vitest'
import { memoryPrompts, promptAt } from '../prompts.js'

const moonLanding = 'Where were you when they landed on the moon in 1969?'

describe('memoryPrompts', () => {
  const profile = {
    name: 'Rose',
    birthYear: 1942,
    anchors: { hometown: 'Dayton', spouse: 'Frank', job: 'school teacher' },
  }

  it('builds personal prompts from anchors first', () => {
    const p = memoryPrompts(profile)
    expect(p[0]).toBe('Tell me about Dayton when you were young.')
    expect(p).toContain('How did you and Frank meet?')
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
    expect(memoryPrompts({ birthYear: 1942 })).toContain('What did you wear to go out in the 1950s?')
  })

  it('skips blank anchors and still returns general prompts', () => {
    const p = memoryPrompts({ anchors: { hometown: '  ', spouse: '', job: null } })
    expect(p.length).toBeGreaterThan(0)
    expect(p.join(' ')).not.toMatch(/undefined|null|\(\)/)
  })

  it('leads with the current song when given', () => {
    const song = { title: 'Moon River', artist: 'Henry Mancini' }
    expect(memoryPrompts(profile, { song })[0]).toBe('Do you remember "Moon River" by Henry Mancini?')
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
