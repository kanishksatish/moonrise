import { expect, it } from 'vitest'
import fs from 'node:fs'
import { createHash } from 'node:crypto'

const catalog = JSON.parse(fs.readFileSync(new URL('../src/assets/audio/catalog.json', import.meta.url), 'utf8'))
const eraSongs = JSON.parse(fs.readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8'))

it('ships real local MP3 files with distinct recording IDs and visible rights/source details', () => {
  expect(catalog.length).toBeGreaterThanOrEqual(10)
  expect(new Set(catalog.map(item => item.id)).size).toBe(catalog.length)
  expect(new Set(catalog.map(item => item.filename)).size).toBe(catalog.length)
  for (const item of catalog) {
    expect(item.id).toMatch(/^bundled-[a-z0-9-]+$/)
    expect(eraSongs.some(song => song.id === item.id)).toBe(false)
    expect(item.filename).toMatch(/^[a-z0-9-]+\.mp3$/)
    for (const key of ['title', 'artist', 'licenseName', 'attribution']) expect(item[key]?.trim().length).toBeGreaterThan(0)
    for (const key of ['sourceUrl', 'licenseUrl']) expect(new URL(item[key]).protocol).toBe('https:')
    expect(item.recordingYear === null || Number.isInteger(item.recordingYear)).toBe(true)
    const bytes = fs.readFileSync(new URL(`../src/assets/audio/${item.filename}`, import.meta.url))
    expect(bytes.byteLength).toBeGreaterThan(10000)
    expect(bytes.byteLength).toBe(item.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256)
    expect(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)).toBe(true)
  }
})
