// Records YouTube oEmbed evidence for every candidate in src/data/videos.json.
// Run on a normal network (no API key needed):
//
//   node scripts/verify-videos.mjs          # report only
//   node scripts/verify-videos.mjs --write  # also save oembedStatus/oembedCheckedAt/oembedInfo
//
// oEmbed 200 means YouTube lists the video as public and embeddable. That is eligibility
// evidence only, NOT proof it plays in Moonrise or in your region, so this script never
// changes `verified`. `verified: true` is set by hand only after actually playing the video
// in the app. Anything other than 200 is recorded as-is (a network or environment failure is
// not proof embedding is disabled).

import fs from 'node:fs'

const FILE = new URL('../src/data/videos.json', import.meta.url)
const write = process.argv.includes('--write')
const videos = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const now = new Date().toISOString()

for (const [songId, v] of Object.entries(videos)) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(v.watchUrl)}&format=json`
  let status
  let info = null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    status = res.status
    if (res.ok) {
      const j = await res.json()
      info = `${j.title} | ${j.author_name}`
    }
  } catch (e) {
    status = 'network-error'
    info = e.message
  }
  console.log(`${String(status).padEnd(14)} ${songId.padEnd(36)} ${info ?? ''}`)
  v.oembedStatus = status
  v.oembedCheckedAt = now
  v.oembedInfo = info
}

if (write) {
  fs.writeFileSync(FILE, JSON.stringify(videos, null, 2) + '\n')
  console.log('Saved oEmbed evidence. `verified` is unchanged: set it only after real playback in the app.')
}
