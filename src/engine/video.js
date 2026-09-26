// In-app music: which catalog songs have a YouTube video the player may embed.
//
// src/data/videos.json holds candidates found by web search (official artist, label or
// "Provided to YouTube" uploads only). scripts/verify-videos.mjs records YouTube oEmbed
// evidence (oembedStatus etc.), which shows embedding eligibility only. A candidate is used
// ONLY once `verified: true`, which is set by hand after real playback in the app.
// Unverified or missing songs return null, so the player shows its "unavailable" state.
// Even verified videos can fail later; the UI keeps its unavailable/next-song states.
// We never download or rehost recordings, and availability (region, ads, removal) is up to
// YouTube; a verified video can still fail to play later.

import videos from '../data/videos.json'

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

// { youtubeId, watchUrl, embedUrl } for a verified video, or null.
export function songVideo(songId, catalog = videos) {
  const v = catalog?.[songId]
  if (!v || v.verified !== true || !ID_PATTERN.test(v.youtubeId ?? '')) return null
  const params = new URLSearchParams({ rel: '0', playsinline: '1' })
  return {
    youtubeId: v.youtubeId,
    watchUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    // Privacy-enhanced domain; no autoplay. The UI starts playback only from a user tap.
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}?${params}`,
  }
}
