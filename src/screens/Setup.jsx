import { useRef, useState } from 'react'
import { findCity } from '../engine/index.js'
import includedCatalog from '../assets/audio/catalog.json'
import Brand from '../components/Brand.jsx'
import MoonIcon from '../components/MoonIcon.jsx'
import '../styles/onboarding.css'

const THIS_YEAR = new Date().getFullYear()

export default function Setup({ profile, onDone, onCancel, focusRef }) {
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
      <form className="screen setup onboarding-page" onSubmit={save} ref={focusRef} tabIndex={-1} aria-label="Caregiver setup">
        <div className="onboarding-brand"><Brand /><span className="onboarding-note">A little light. A familiar song.</span></div>
        <header className="onboarding-intro">
          <p className="eyebrow">A place to begin</p>
          <h1>A familiar rhythm.<br/><em>A little time together.</em></h1>
          <p className="lead">Music, conversation, and a moment to sit together. Let’s shape the evening around the person you care for.</p>
          <div className="onboarding-sky" aria-hidden="true">
            <div className="onboarding-orbit onboarding-orbit-outer" />
            <div className="onboarding-orbit onboarding-orbit-inner" />
            <span className="onboarding-star onboarding-star-one" />
            <span className="onboarding-star onboarding-star-two" />
            <span className="onboarding-star onboarding-star-three" />
            <MoonIcon phase={0.43} decorative />
            <div className="onboarding-horizon" />
          </div>
          <p className="onboarding-footer">The sky suggests a time.<br/>You decide what feels right.</p>
        </header>

        <div className="onboarding-form">
          <section className="onboarding-section" aria-labelledby="setup-person-title">
            <div className="onboarding-section-heading"><span aria-hidden="true">01</span><h2 id="setup-person-title">Who’s this evening for?</h2></div>
            <div className="onboarding-person-fields">
              <label className="field">
                <span>Their first name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Rose" required />
              </label>
              <label className="field">
                <span>Year they were born</span>
                <input
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="e.g. 1942"
                  required
                  aria-describedby="setup-year-note"
                  aria-invalid={birthYear.length === 4 && !yearValid ? true : undefined}
                />
              </label>
            </div>
            <p id="setup-year-note" className="onboarding-section-note">{birthYear.length === 4 && !yearValid ? `Use a birth year between 1900 and ${THIS_YEAR - 30}.` : 'Their birth year helps us choose conversation starters.'}</p>
            {yearValid && (
              <div className="onboarding-era">
                <p className="era-title">There’s room for their favorites.</p>
                <p>Choose from {includedCatalog.length} included recordings or bring a music file of your own.</p>
              </div>
            )}
          </section>

          <section className="onboarding-section" aria-labelledby="setup-location-title">
            <div className="onboarding-section-heading"><span aria-hidden="true">02</span><h2 id="setup-location-title">Under your sky.</h2></div>
            <p className="onboarding-section-note">Local sunset and cloud cover help suggest when to begin.</p>
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

          <details className="onboarding-section onboarding-optional">
            <summary className="onboarding-section-heading"><span aria-hidden="true">03</span><span className="onboarding-optional-title">A few familiar details<span className="muted">Optional · you can add these later</span></span><span className="onboarding-expand" aria-hidden="true"/></summary>
            <div className="onboarding-anchor-fields">
              <p className="onboarding-section-note">Choose people and places they enjoy talking about. It’s fine to leave anything blank.</p>
              <label className="field"><span>Hometown</span><input value={anchors.hometown} onChange={setAnchor('hometown')} placeholder="e.g. Dayton" /></label>
              <label className="field"><span>Husband or wife’s name</span><input value={anchors.spouse} onChange={setAnchor('spouse')} placeholder="e.g. Frank" /></label>
              <label className="field"><span>Their job</span><input value={anchors.job} onChange={setAnchor('job')} placeholder="e.g. school teacher" /></label>
            </div>
          </details>
          <div className="onboarding-actions">
            {!canSave && <p className="onboarding-ready-note">Add their name, birth year, and location to begin.</p>}
            <button type="submit" className="btn primary big" disabled={!canSave}><span>{profile ? 'Save' : 'Start'}</span><span aria-hidden="true">↗</span></button>
            {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
            <p className="onboarding-support-note">Caregiver support, not a medical treatment.</p>
          </div>
        </div>
      </form>
    </div>
  )
}
