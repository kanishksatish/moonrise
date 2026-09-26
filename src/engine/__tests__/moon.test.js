import { describe, it, expect } from 'vitest'
import { phaseName, moonPhase, darknessFromAltitude, skyGradient, skyState } from '../moon.js'

describe('phaseName', () => {
  it('names the main phases', () => {
    expect(phaseName(0)).toBe('New Moon')
    expect(phaseName(0.25)).toBe('First Quarter')
    expect(phaseName(0.5)).toBe('Full Moon')
    expect(phaseName(0.75)).toBe('Last Quarter')
    expect(phaseName(0.98)).toBe('New Moon')
    expect(phaseName(0.1)).toBe('Waxing Crescent')
  })
})

describe('moonPhase', () => {
  it('matches known full and new moons', () => {
    // Full moon 2024-09-18 02:34 UTC, new moon 2024-10-02 18:49 UTC.
    const full = moonPhase(new Date('2024-09-18T02:34:00Z'))
    expect(full.name).toBe('Full Moon')
    expect(full.illumination).toBeGreaterThan(0.99)
    const fresh = moonPhase(new Date('2024-10-02T18:49:00Z'))
    expect(fresh.name).toBe('New Moon')
    expect(fresh.illumination).toBeLessThan(0.01)
  })
})

describe('darknessFromAltitude', () => {
  it('is 0 in daylight, 1 at night, linear through twilight', () => {
    expect(darknessFromAltitude(30)).toBe(0)
    expect(darknessFromAltitude(6)).toBe(0)
    expect(darknessFromAltitude(-3)).toBe(0.5)
    expect(darknessFromAltitude(-12)).toBe(1)
    expect(darknessFromAltitude(-40)).toBe(1)
  })
})

describe('skyGradient', () => {
  it('hits the day, dusk and night stops', () => {
    expect(skyGradient(0)).toEqual({ top: '#2b64a8', bottom: '#3f78b8' })
    expect(skyGradient(0.5)).toEqual({ top: '#3b3a78', bottom: '#a4522a' })
    expect(skyGradient(1)).toEqual({ top: '#0b1030', bottom: '#26204a' })
  })
  it('blends between stops and clamps', () => {
    expect(skyGradient(0.25).top).toMatch(/^#[0-9a-f]{6}$/)
    expect(skyGradient(2)).toEqual(skyGradient(1))
  })
})

describe('sky contrast', () => {
  const luminance = (hex) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const whiteContrast = (hex) => 1.05 / (luminance(hex) + 0.05)

  it('keeps white text at 4.5:1 or better on every color of the gradient', () => {
    for (let i = 0; i <= 100; i++) {
      const { top, bottom } = skyGradient(i / 100)
      expect(whiteContrast(top)).toBeGreaterThanOrEqual(4.5)
      expect(whiteContrast(bottom)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('skyState', () => {
  const lat = 51.5
  const lon = -0.12
  it('is light at midday and dark at midnight', () => {
    const noon = skyState(new Date('2026-06-21T12:00:00Z'), lat, lon)
    const night = skyState(new Date('2026-12-21T00:00:00Z'), lat, lon)
    expect(noon.darkness).toBe(0)
    expect(noon.brightness).toBe(0.5)
    expect(night.darkness).toBe(1)
    expect(night.warmth).toBe(1)
    expect(night.brightness).toBe(1)
  })
  it('gets darker, warmer and brighter through the evening', () => {
    const times = ['16:00', '17:30', '18:00', '18:30', '19:30'].map((t) => new Date(`2026-09-26T${t}:00Z`))
    const states = times.map((t) => skyState(t, lat, lon))
    for (let i = 1; i < states.length; i++) {
      expect(states[i].darkness).toBeGreaterThanOrEqual(states[i - 1].darkness)
      expect(states[i].brightness).toBeGreaterThanOrEqual(states[i - 1].brightness)
    }
    expect(states.at(-1).darkness).toBeGreaterThan(states[0].darkness)
  })
})
