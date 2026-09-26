// Song evidence: plain counts from the family's own logged evenings.
//
// For each song: on how many logged evenings it was recorded as played, and how those
// evenings went. A catalog song is recorded only when the in-app player reports it actually
// playing (the included piano and caregiver-chosen local files are never recorded as catalog
// songs). These are descriptive counts only: not a probability, a rating of the song, or
// evidence that a song helps. Several things happen on the same evening, and a song playing
// doesn't mean the person was listening.
// (Why Moonrise shows counts instead of a fancier estimate: METHODOLOGY.md.)

const OUTCOMES = ['calm', 'restless', 'episode']

// { [songId]: { plays, calm, restless, episode, score } }
// Each song counts once per evening; evenings with an unknown outcome are ignored.
// `score` is the AGENTS.md ranking score: calm - episode.
export function songEvidence(logs = []) {
  const out = {}
  for (const log of logs) {
    if (!OUTCOMES.includes(log.outcome)) continue
    for (const id of new Set(log.songIds ?? [])) {
      const e = (out[id] ??= { plays: 0, calm: 0, restless: 0, episode: 0, score: 0 })
      e.plays += 1
      e[log.outcome] += 1
      e.score = e.calm - e.episode
    }
  }
  return out
}

// "Played in the app on 5 logged evenings: 3 calm, 1 restless, 1 episode."
export function evidenceText(e) {
  if (!e || !e.plays) return 'Not played in the app on a logged evening yet.'
  const parts = []
  if (e.calm) parts.push(`${e.calm} calm`)
  if (e.restless) parts.push(`${e.restless} restless`)
  if (e.episode) parts.push(`${e.episode} ${e.episode === 1 ? 'episode' : 'episodes'}`)
  return `Played in the app on ${e.plays} logged ${e.plays === 1 ? 'evening' : 'evenings'}: ${parts.join(', ')}.`
}
