// Song evidence: plain counts from the family's own logged evenings.
//
// For each song: on how many logged evenings its link was opened, and how those evenings
// went. These are descriptive counts only. They are not a probability, a rating of the
// song, or evidence that a song helps: several songs can be opened on the same evening,
// and an opened link doesn't confirm the music was actually played.
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

// "Opened on 5 logged evenings: 3 calm, 1 restless, 1 episode."
export function evidenceText(e) {
  if (!e || !e.plays) return 'Not opened on a logged evening yet.'
  const parts = []
  if (e.calm) parts.push(`${e.calm} calm`)
  if (e.restless) parts.push(`${e.restless} restless`)
  if (e.episode) parts.push(`${e.episode} ${e.episode === 1 ? 'episode' : 'episodes'}`)
  return `Opened on ${e.plays} logged ${e.plays === 1 ? 'evening' : 'evenings'}: ${parts.join(', ')}.`
}
