import { useRef, useState } from 'react'
import { eraSongs, eraYears, findCity } from '../engine/index.js'
import Brand from '../components/Brand.jsx'
import MoonIcon from '../components/MoonIcon.jsx'
import '../styles/onboarding.css'

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
    <div className="app onboarding-app">
      <form className="screen setup onboarding-page" onSubmit={save}>
        <div className="onboarding-brand"><Brand /><span className="onboarding-note">A little light. A familiar song.</span></div>
        <header className="onboarding-intro">
          <p className="eyebrow">The evening starts here</p>
          <h1>Make room for<br/><em>a gentler evening.</em></h1>
          <p className="lead">A personal evening routine, timed to the real sky. Let’s start with the person you care for.</p>
          <div className="onboarding-sky" aria-hidden="true">
            <div className="onboarding-orbit onboarding-orbit-outer" />
            <div className="onboarding-orbit onboarding-orbit-inner" />
            <span className="onboarding-star onboarding-star-one" />
            <span className="onboarding-star onboarding-star-two" />
            <span className="onboarding-star onboarding-star-three" />
            <MoonIcon phase={0.43} decorative />
            <div className="onboarding-horizon" />
          </div>
          <p className="onboarding-footer">Real sky. Familiar music.<br/>A moment together.</p>
        </header>

        <div className="onboarding-form">
          <section className="onboarding-section" aria-labelledby="setup-person-title">
            <div className="onboarding-section-heading"><span aria-hidden="true">01</span><h2 id="setup-person-title">Their story.</h2></div>
            <div className="onboarding-person-fields">
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
            </div>
            {era && (
              <div className="onboarding-era">
                <p className="era-title">Their songs: {era.from} to {era.to} · {songs.length} found</p>
                <ul className="era-list">
                  {songs.slice(0, 5).map((s) => (
                    <li key={s.id}>{s.title} <span className="muted">· {s.artist}, {s.year}</span></li>
                  ))}
                  {songs.length > 5 && <li className="muted">and {songs.length - 5} more</li>}
                </ul>
              </div>
            )}
          </section>

          <section className="onboarding-section" aria-labelledby="setup-location-title">
            <div className="onboarding-section-heading"><span aria-hidden="true">02</span><h2 id="setup-location-title">Under your sky.</h2></div>
            <div className="field">
              <span>Where you are (for tonight’s sky)</span>
              {place ? (
                <div className="place-row onboarding-place">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
                  <strong>{place.city}</strong>
                  <button type="button" className="btn small" onClick={() => setPlace(null)}>Change</button>
                </div>
              ) : (
                <>
                  <button type="button" className="btn location-button" onClick={useMyLocation} disabled={locating}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
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
                    <button type="button" className="btn" onClick={lookUpCity} disabled={locating || !cityText.trim()}>Find</button>
                  </div>
                </>
              )}
              {locStatus && <p className="status" role="status">{locStatus}</p>}
            </div>
          </section>

          <section className="onboarding-section" aria-labelledby="setup-anchors-title">
            <div className="onboarding-section-heading"><span aria-hidden="true">03</span><h2 id="setup-anchors-title">Memory anchors <span className="muted">(optional)</span></h2></div>
            <p className="onboarding-section-note">Familiar places and people to begin a conversation.</p>
            <label className="field"><span>Hometown</span><input value={anchors.hometown} onChange={setAnchor('hometown')} placeholder="e.g. Dayton" /></label>
            <label className="field"><span>Husband or wife’s name</span><input value={anchors.spouse} onChange={setAnchor('spouse')} placeholder="e.g. Frank" /></label>
            <label className="field"><span>Their job</span><input value={anchors.job} onChange={setAnchor('job')} placeholder="e.g. school teacher" /></label>
          </section>
          <div className="onboarding-actions">
            <button type="submit" className="btn primary big" disabled={!canSave}><span>{profile ? 'Save' : 'Start'}</span><span aria-hidden="true">↗</span></button>
            {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
          </div>
        </div>
      </form>
    </div>
  )
}
