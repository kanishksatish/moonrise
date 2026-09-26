import { describe, it, expect } from 'vitest'
import seedSongs from '../../data/songs.json'
import { seededRandom } from '../random.js'
import {
  eraYears,
  eraSongs,
  songScore,
  playlist,
  findSong,
  spotifySearchUrl,
  youtubeSearchUrl,
} from '../songs.js'

const songs = [
  { id: 'a', title: 'A', artist: 'X', year: 1950 },
  { id: 'b', title: 'B', artist: 'X', year: 1952 },
  { id: 'c', title: 'C', artist: 'X', year: 1960 },
  { id: 'd', title: 'D', artist: 'X', year: 1972 },
  { id: 'e', title: 'E', artist: 'X', year: 1973 },
]

describe('songs.json', () => {
  it('has unique ids and covers the 1940s to 1970s', () => {
    const ids = seedSongs.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const decade of [1940, 1950, 1960, 1970]) {
      expect(seedSongs.some((s) => s.year >= decade && s.year < decade + 10)).toBe(true)
    }
    for (const s of seedSongs) {
      expect(s.title && s.artist && Number.isInteger(s.year)).toBeTruthy()
    }
  })
})

describe('eraYears / eraSongs', () => {
  it('is age 10 to 30', () => {
    expect(eraYears(1942)).toEqual({ from: 1952, to: 1972 })
  })
  it('filters inclusively to the era window', () => {
    expect(eraSongs(1942, songs).map((s) => s.id)).toEqual(['b', 'c', 'd'])
  })
  it('finds real seed songs for someone born in 1942', () => {
    const era = eraSongs(1942)
    expect(era.length).toBeGreaterThan(10)
    expect(era.every((s) => s.year >= 1952 && s.year <= 1972)).toBe(true)
  })
})

describe('songScore', () => {
  const logs = [
    { outcome: 'calm', songIds: ['b', 'c'] },
    { outcome: 'calm', songIds: ['b'] },
    { outcome: 'episode', songIds: ['c', 'd'] },
    { outcome: 'restless', songIds: ['b', 'd'] },
  ]
  it('adds 1 per calm evening and subtracts 1 per episode evening', () => {
    expect(songScore('b', logs)).toBe(2)
    expect(songScore('c', logs)).toBe(0)
    expect(songScore('d', logs)).toBe(-1)
  })
  it('is 0 for songs never played or logs without songs', () => {
    expect(songScore('a', logs)).toBe(0)
    expect(songScore('a', [{ outcome: 'calm' }])).toBe(0)
  })
})

describe('playlist', () => {
  it('sorts by score, best first', () => {
    const logs = [
      { outcome: 'calm', songIds: ['d'] },
      { outcome: 'episode', songIds: ['b'] },
    ]
    const ids = playlist(1942, logs, { songs, random: seededRandom(1) }).map((s) => s.id)
    expect(ids).toEqual(['d', 'c', 'b'])
  })
  it('includes the score on each song', () => {
    const list = playlist(1942, [{ outcome: 'calm', songIds: ['c'] }], { songs })
    expect(list[0]).toMatchObject({ id: 'c', score: 1 })
  })
  it('breaks ties randomly', () => {
    const orders = new Set()
    for (let seed = 1; seed <= 20; seed++) {
      orders.add(playlist(1942, [], { songs, random: seededRandom(seed) }).map((s) => s.id).join())
    }
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('links', () => {
  const song = { id: 'x', title: 'Moon River', artist: 'Henry Mancini', year: 1961 }
  it('builds Spotify and YouTube search links', () => {
    expect(spotifySearchUrl(song)).toBe('https://open.spotify.com/search/Moon%20River%20Henry%20Mancini')
    expect(youtubeSearchUrl(song)).toContain('search_query=Moon%20River%20Henry%20Mancini%201961')
  })
  it('finds songs by id', () => {
    expect(findSong('moon-river-1961')?.title).toBe('Moon River')
    expect(findSong('nope')).toBeNull()
  })
})
