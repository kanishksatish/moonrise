import catalog from '../assets/audio/catalog.json'

// Vite imports local files as hashed build assets. No remote playback URLs or
// era-song IDs are inferred from a recording's title, performer, or age.
const files = import.meta.glob('../assets/audio/*.mp3', { eager: true, query: '?url', import: 'default' })
export const bundledMusic = catalog.map(recording => {
  const src = files[`../assets/audio/${recording.filename}`]
  if (!src) throw new Error(`Missing bundled recording: ${recording.filename}`)
  return { ...recording, src }
})
