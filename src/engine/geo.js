// City lookup for Setup, when the browser can't (or may not) share its location.
// Uses Open-Meteo's free geocoding API (no key).
//
// findCity(name) resolves to { lat, lon, city } for the best match.
// It resolves to null ONLY for a blank name or a successful response with no matches
// (Open-Meteo omits `results` or sends an empty array). It REJECTS on HTTP errors, network
// failure, timeout, or a malformed response, so the UI can tell "no such city" apart from
// "couldn't check right now".

import { DEFAULT_TIMEOUT_MS, fetchJson } from './net.js'

export function geocodeUrl(name) {
  const params = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' })
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`
}

export async function findCity(name, { fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const query = typeof name === 'string' ? name.trim() : ''
  if (!query) return null
  const json = await fetchJson(geocodeUrl(query), { fetchFn, timeoutMs })
  if (!json || typeof json !== 'object') throw new Error('Malformed geocoding response')
  if (json.results === undefined) return null
  if (!Array.isArray(json.results)) throw new Error('Malformed geocoding response')
  if (json.results.length === 0) return null

  const place = json.results[0]
  const placeName = typeof place?.name === 'string' ? place.name.trim() : ''
  if (!Number.isFinite(place?.latitude) || !Number.isFinite(place?.longitude) || !placeName) {
    throw new Error('Malformed geocoding result')
  }
  const city = [placeName, place.admin1, place.country].filter((part) => typeof part === 'string' && part).join(', ')
  return { lat: place.latitude, lon: place.longitude, city }
}
