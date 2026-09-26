import { describe, it, expect } from 'vitest'
import videos from '../../data/videos.json'
import songs from '../../data/songs.json'
import { songVideo } from '../video.js'

describe('videos.json', () => {
  it('only references real catalog songs, with well-formed ids and watch URLs', () => {
    const ids = new Set(songs.map((s) => s.id))
    for (const [songId, v] of Object.entries(videos)) {
      expect(ids.has(songId)).toBe(true)
      expect(v.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      expect(v.watchUrl).toBe(`https://www.youtube.com/watch?v=${v.youtubeId}`)
      expect(typeof v.verified).toBe('boolean')
      expect(v).toHaveProperty('oembedStatus')
      expect(v).toHaveProperty('oembedCheckedAt')
    }
  })
})

describe('songVideo', () => {
  const catalog = {
    ok: { youtubeId: 'Ozg3P3LrJs8', verified: true },
    unverified: { youtubeId: 'Ozg3P3LrJs8', verified: false },
    bad: { youtubeId: 'not-an-id', verified: true },
  }
  it('returns a no-autoplay, privacy-enhanced embed for verified videos only', () => {
    const v = songVideo('ok', catalog)
    expect(v.watchUrl).toBe('https://www.youtube.com/watch?v=Ozg3P3LrJs8')
    expect(v.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/Ozg3P3LrJs8\?/)
    expect(v.embedUrl).not.toMatch(/autoplay/)
  })
  it('returns null for unverified, malformed or unknown entries', () => {
    expect(songVideo('unverified', catalog)).toBeNull()
    expect(songVideo('bad', catalog)).toBeNull()
    expect(songVideo('nope', catalog)).toBeNull()
  })
  it('exposes nothing from the shipped data until someone verifies it', () => {
    for (const id of Object.keys(videos)) if (!videos[id].verified) expect(songVideo(id)).toBeNull()
  })
})

describe('shipped candidates', () => {
  it('has 10-15 candidates and none is playback-verified yet', () => {
    const n = Object.keys(videos).length
    expect(n).toBeGreaterThanOrEqual(10)
    expect(n).toBeLessThanOrEqual(15)
    for (const v of Object.values(videos)) expect(v.verified).toBe(false)
  })
})
