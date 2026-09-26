import { useEffect, useRef, useState } from 'react'
import { addLog } from '../engine/index.js'
import { prettyDate } from '../components/format.js'
import { eveningKey, makeEveningLog } from '../components/eveningLog.js'
import { CARE_PLAN_NOTE, COMFORT_STEPS, cleanCareContext, comfortStepsText } from '../engine/index.js'
import '../styles/onboarding.css'
import '../styles/care-workflow.css'

const OUTCOMES = [
  { id: 'calm', label: 'Calm', hint: 'A peaceful evening' },
  { id: 'restless', label: 'Restless', hint: 'Seemed unsettled' },
  { id: 'episode', label: 'Episode', hint: 'Agitated or confused' },
]

function OutcomeMark({ outcome }) {
  return (
    <svg className="outcome-mark" aria-hidden="true" viewBox="0 0 72 72" fill="none">
      <circle className="outcome-mark-orbit" cx="36" cy="36" r="34" />
      {outcome === 'calm' && <><path d="M17 29h38M17 36h38M17 43h38"/><circle cx="36" cy="20" r="2" fill="currentColor" stroke="none"/></>}
      {outcome === 'restless' && <><path d="M16 29c7-11 13 11 20 0s13 11 20 0M16 37c7-11 13 11 20 0s13 11 20 0M16 45c7-11 13 11 20 0s13 11 20 0"/></>}
      {outcome === 'episode' && <><path d="m16 37 9-9 11 17 11-17 9 9M21 48h30M21 21h30"/></>}
    </svg>
  )
}

function timeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function Log({ state, sky, update, onDone }) {
  const today = eveningKey()
  const existing = state.logs.find((l) => l.date === today && !l.demo)
  const savedContext = cleanCareContext(existing?.careContext)
  const [askTime, setAskTime] = useState(false)
  const timeHeading = useRef(null)
  const [error, setError] = useState('')
  const [errorLocation, setErrorLocation] = useState('outcome')
  const [deviceSaveFailed, setDeviceSaveFailed] = useState(false)
  const [savedEpisodeStart, setSavedEpisodeStart] = useState(existing?.episodeStart ?? null)
  const [steps, setSteps] = useState(() => savedContext?.comfortSteps ?? [])
  const [noneReported, setNoneReported] = useState(() => savedContext?.comfortSteps.length === 0)
  const [contextDirty, setContextDirty] = useState(false)
  const [contextSaved, setContextSaved] = useState(false)
  const [time, setTime] = useState(() =>
    existing?.episodeStart ? timeValue(new Date(existing.episodeStart)) : timeValue(new Date())
  )

  useEffect(() => {
    // A draft belongs to one evening. Never carry unsaved details over at 04:00.
    const context = cleanCareContext(existing?.careContext)
    setSteps(context?.comfortSteps ?? [])
    setNoneReported(context?.comfortSteps.length === 0)
    setContextDirty(false)
    setContextSaved(false)
    setAskTime(false)
    setDeviceSaveFailed(false)
    setSavedEpisodeStart(existing?.episodeStart ?? null)
    setTime(existing?.episodeStart ? timeValue(new Date(existing.episodeStart)) : timeValue(new Date()))
  }, [today])

  useEffect(() => {
    if (askTime) timeHeading.current?.focus()
  }, [askTime])

  function save(outcome, episodeTime, location = 'outcome') {
    setErrorLocation(location)
    setContextSaved(false)
    try {
      if (contextDirty && !steps.length && !noneReported) {
        throw new Error('Choose a comfort step, choose “None of these,” or discard the optional changes.')
      }
      const context = contextDirty ? { source: 'caregiver', comfortSteps: steps } : undefined
      const log = makeEveningLog(state, sky, outcome, episodeTime, new Date(), context)
      if (update(addLog(state, log)) === false) {
        // App keeps the edit in memory on failure. Keep this screen and its
        // draft retryable; an in-memory edit is not a completed device save.
        setDeviceSaveFailed(true)
        setError('This note was not saved to this device. Your changes are still here. Keep this page open and try saving again.')
        return false
      }
      setError('')
      setDeviceSaveFailed(false)
      setSavedEpisodeStart(log.episodeStart)
      setContextDirty(false)
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  function choose(outcome) {
    if (!save(outcome)) return
    if (outcome === 'episode') setAskTime(true)
    else onDone()
  }

  function saveTime() {
    if (save('episode', time, 'onset')) onDone()
  }

  function toggleStep(id) {
    setSteps(current => current.includes(id) ? current.filter(step => step !== id) : [...current, id])
    setNoneReported(false)
    setContextDirty(true)
    setContextSaved(false)
    setError('')
  }

  function discardContext() {
    setSteps(savedContext?.comfortSteps ?? [])
    setNoneReported(savedContext?.comfortSteps.length === 0)
    setContextDirty(false)
    setContextSaved(false)
    setError('')
  }

  if (!sky) return <p className="big-number">Checking tonight’s sky…</p>

  if (askTime) {
    return (
      <div className="log evening-journal log-time">
        <header className="journal-heading">
          <p className="eyebrow">{deviceSaveFailed ? 'Time change not saved to device' : 'Episode saved · optional detail'}</p>
          <h1 ref={timeHeading} tabIndex={-1}>When did it start?</h1>
          <p className="lead">Evening of {prettyDate(today)}. After-midnight times count toward this evening.</p>
        </header>
        <div className="journal-time-entry">
          <svg className="journal-clock" aria-hidden="true" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="27"/><path d="M32 14v18l11 7M32 5v4M32 55v4M5 32h4M55 32h4"/></svg>
          <p>Record the time you noticed it, if known. This is your observation, not a diagnosis.</p>
          {error && <p className="status" role="alert">{error}</p>}
          <input
            className="time-input"
            type="time"
            value={time}
            onChange={(e) => { setTime(e.target.value); setError('') }}
            aria-label="Episode started at"
          />
          <div className="journal-time-actions">
            <button className="btn primary huge" onClick={saveTime}>Save time</button>
            <button className="btn" onClick={onDone}>{deviceSaveFailed ? 'Leave for now (not saved)' : savedEpisodeStart ? 'Keep saved time' : 'Skip'}</button>
            {savedEpisodeStart && <button className="btn" onClick={() => { if (save('episode', null, 'onset')) onDone() }}>Remove saved time</button>}
          </div>
        </div>
        <p className="care-plan-note">{CARE_PLAN_NOTE}</p>
      </div>
    )
  }

  return (
    <div className="log evening-journal">
      <header className="journal-heading">
        <p className="eyebrow">The evening journal</p>
        <h1>How was tonight?</h1>
        <p className="lead">Your observation, in one tap.</p>
        <p className="journal-date"><span aria-hidden="true"/>Evening of {prettyDate(today)}</p>
      </header>
      {error && errorLocation !== 'comfort' && <p className="status" role="alert">{error}</p>}
      {existing && <p className="journal-recorded">{deviceSaveFailed ? 'Current label (not saved to device):' : 'Recorded as'} <strong>{existing.outcome}</strong>. Tap to save a change.</p>}
      <p className="care-save-hint">Tap an evening below to save it. Optional comfort steps are included only if you add them.</p>
      <div className="journal-outcomes">
        {OUTCOMES.map((o) => (
          <button
            key={o.id}
            aria-label={o.label}
            aria-describedby={`outcome-${o.id}-hint`}
            className={`btn outcome ${o.id}${existing?.outcome === o.id ? ' chosen' : ''}`}
            onClick={() => choose(o.id)}
          >
            <OutcomeMark outcome={o.id} />
            <span className="outcome-copy">
              <span className="outcome-label">{o.label}</span>
              <span className="outcome-hint" id={`outcome-${o.id}-hint`}>{o.hint}</span>
            </span>
            <span className="outcome-action" aria-hidden="true">{existing?.outcome === o.id ? '✓' : '↗'}</span>
          </button>
        ))}
      </div>
      <details className="comfort-editor">
        <summary>Comfort steps used <span>Optional</span></summary>
        <div className="comfort-editor-content">
          <p id="comfort-help">What did you use this evening? These are your notes, not recommended actions or a measure of what worked.</p>
          {savedContext && <p className="comfort-saved-summary">Current details{deviceSaveFailed ? ' (not saved to device)' : ''}: {comfortStepsText(savedContext)}</p>}
          <fieldset aria-describedby="comfort-help">
            <legend>Choose any that you used</legend>
            {COMFORT_STEPS.map(step => (
              <label className="comfort-choice" key={step.id}>
                <input type="checkbox" checked={steps.includes(step.id)} onChange={() => toggleStep(step.id)} />
                <span>{step.label}</span>
              </label>
            ))}
            <label className="comfort-choice comfort-none">
              <input type="checkbox" checked={Boolean(noneReported)} onChange={event => {
                setNoneReported(event.target.checked); setSteps([]); setContextDirty(true); setContextSaved(false); setError('')
              }} />
              <span>None of these</span>
            </label>
          </fieldset>
          <p className="comfort-save-note">{existing ? 'Save these details when ready, or tap an evening above to save both.' : 'Choose an evening above to save your observation and these details together.'} Leaving this blank means “not recorded.”</p>
          {error && errorLocation === 'comfort' && <p className="status" role="alert">{error}</p>}
          <div className="comfort-actions">
            {existing && <button className="btn primary" disabled={!contextDirty || (!steps.length && !noneReported)} onClick={() => {
              if (save(existing.outcome, undefined, 'comfort')) setContextSaved(true)
            }}>Save comfort steps</button>}
            {contextDirty && !deviceSaveFailed && <button className="btn" onClick={discardContext}>Discard optional changes</button>}
          </div>
          {contextSaved && <p role="status">Comfort steps saved for this evening.</p>}
        </div>
      </details>
      <p className="care-plan-note">{CARE_PLAN_NOTE}</p>
    </div>
  )
}
