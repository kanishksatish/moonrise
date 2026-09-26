import { eveningDate, episodeStartFromTime, localDateString } from '../engine/index.js'
import { cleanCareContext } from '../engine/careContext.js'

export function eveningKey(now = new Date()) {
  const evening = eveningDate(now)
  return evening ? localDateString(evening) : null
}

export function currentSky(sky, profile, now = new Date()) {
  return sky?.date === eveningKey(now) && sky?.lat === profile.lat && sky?.lon === profile.lon
    ? sky
    : null
}

// Capture one moment for the entire save. Never pair a new evening with yesterday's sky.
export function makeEveningLog(state, sky, outcome, time, now = new Date(), careContext) {
  const evening = eveningDate(now)
  if (!evening || !currentSky(sky, state.profile, now) || !Number.isFinite(sky.effectiveDusk?.getTime())) {
    throw new Error('The evening has changed. Please wait for the sky to refresh, then try again.')
  }
  const date = localDateString(evening)
  const existing = state.logs.find(log => log.date === date && !log.demo)
  let episodeStart = outcome === 'episode' ? existing?.episodeStart ?? null : null
  if (outcome === 'episode' && time === null) episodeStart = null
  else if (outcome === 'episode' && time !== undefined) {
    episodeStart = episodeStartFromTime(evening, time)
    if (!episodeStart) throw new Error('Choose a valid time, or skip the time for now.')
    if (new Date(episodeStart) > now) throw new Error('The start time cannot be in the future. Check the time or choose Skip.')
  }
  const songIds = state.tonight?.date === date ? state.tonight.songIds : existing?.songIds ?? []
  const context = cleanCareContext(careContext === undefined ? existing?.careContext : careContext)
  return { date, outcome, episodeStart, effectiveDusk: sky.effectiveDusk.toISOString(),
    cloudCover: sky.cloudCover, songIds: [...songIds], ...(context ? { careContext: context } : {}) }
}
