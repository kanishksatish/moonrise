import { useRef, useState } from 'react'
import { eraSongs, eraYears, findCity } from '../engine/index.js'

const THIS_YEAR = new Date().getFullYear()

export default function Setup({ profile, onDone, onCancel }) {
  const [name, setName] = useState(profile?.name ?? '')
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : '')
  const [place, setPlace] = useState(
    profile ? { lat: profile.lat, lon: profile.lon, city: profile.city } : null
  )
  const [cityText, setCityText] = useState('')
  const [locStatus, setLocStatus] = useState('')
  const [locating, setLocating] = useState(false)
  const lookupId = useRef(0)
  const [anchors, setAnchors] = useState(profile?.anchors ?? { hometown: '', spouse: '', job: '' })

  const year = Number(birthYear)
  const yearValid = Number.isInteger(year) && year >= 1900 && year <= THIS_YEAR - 30
  const songs = yearValid ? eraSongs(year) : []
  const era = yearValid ? eraYears(year) : null
  const canSave = name.trim() && yearValid && place

  function useMyLocation() {
    if (locating) return
    if (!navigator.geolocation) {
      setLocStatus('Location is not available here. Type a city instead.')
      return
    }
    setLocStatus('Finding you…')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: 'My location' })
        setLocStatus('')
        setLocating(false)
      },
      () => { setLocStatus('Could not get your location. Type a city instead.'); setLocating(false) },
      { timeout: 10000 }
    )
  }

  async function lookUpCity(e) {
    e.preventDefault()
    if (!cityText.trim() || locating) return
    const id = ++lookupId.current
    setLocating(true)
    setLocStatus('Looking up…')
    try {
      const result = await findCity(cityText.trim())
      if (id !== lookupId.current) return
      setPlace(result)
      setLocStatus(result ? '' : 'Could not find that city. Check the spelling, or try a bigger town nearby.')
    } catch {
      if (id === lookupId.current) setLocStatus('Could not check cities right now. Try again or use my location.')
    } finally {
      if (id === lookupId.current) setLocating(false)
    }
  }

  function save(e) {
    e.preventDefault()
    if (!canSave) return
    onDone({
      name: name.trim(),
      birthYear: year,
      lat: place.lat,
      lon: place.lon,
      city: place.city,
      anchors: {
        hometown: anchors.hometown.trim(),
        spouse: anchors.spouse.trim(),
        job: anchors.job.trim(),
      },
    })
  }

  const setAnchor = (key) => (e) => setAnchors({ ...anchors, [key]: e.target.value })

  return (
    <div className="app">
      <form className="screen setup" onSubmit={save}>
        <h1>Welcome to Moonrise</h1>
        <p className="lead">A calm evening routine, timed to the real sky. Tell us a little about who you care for.</p>

        <label className="field">
          <span>Their first name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>

        <label className="field">
          <span>Year they were born</span>
          <input
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="e.g. 1942"
          />
        </label>

        {era && (
          <div className="card era">
            <p className="era-title">
              Their songs: {era.from} to {era.to} · {songs.length} found
            </p>
            <ul className="era-list">
              {songs.slice(0, 5).map((s) => (
                <li key={s.id}>
                  {s.title} <span className="muted">· {s.artist}, {s.year}</span>
                </li>
              ))}
              {songs.length > 5 && <li className="muted">and {songs.length - 5} more</li>}
            </ul>
          </div>
        )}

        <div className="field">
          <span>Where you are (for tonight’s sky)</span>
          {place ? (
            <div className="place-row">
              <strong>{place.city}</strong>
              <button type="button" className="btn small" onClick={() => setPlace(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn primary" onClick={useMyLocation} disabled={locating}>
                Use my location
              </button>
              <div className="city-row">
                <input
                  value={cityText}
                  aria-label="City"
                  disabled={locating}
                  onChange={(e) => { setCityText(e.target.value); setLocStatus('') }}
                  placeholder="or type a city"
                  onKeyDown={(e) => e.key === 'Enter' && lookUpCity(e)}
                />
                <button type="button" className="btn" onClick={lookUpCity} disabled={locating || !cityText.trim()}>
                  Find
                </button>
              </div>
            </>
          )}
          {locStatus && <p className="status" role="status">{locStatus}</p>}
        </div>

        <h2>Memory anchors <span className="muted">(optional)</span></h2>
        <label className="field">
          <span>Hometown</span>
          <input value={anchors.hometown} onChange={setAnchor('hometown')} placeholder="e.g. Dayton" />
        </label>
        <label className="field">
          <span>Husband or wife’s name</span>
          <input value={anchors.spouse} onChange={setAnchor('spouse')} placeholder="e.g. Frank" />
        </label>
        <label className="field">
          <span>Their job</span>
          <input value={anchors.job} onChange={setAnchor('job')} placeholder="e.g. school teacher" />
        </label>

        <button type="submit" className="btn primary big" disabled={!canSave}>
          {profile ? 'Save' : 'Start'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>
    </div>
  )
}
