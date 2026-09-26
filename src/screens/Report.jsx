import { useState } from 'react'
import { weeklyReport } from '../engine/index.js'
import { CARE_PLAN_NOTE, comfortStepsText, handoffCoverage, logsForHandoff } from '../engine/index.js'
import eraCatalog from '../data/songs.json'
import includedCatalog from '../assets/audio/catalog.json'
import { prettyDate } from '../components/format.js'
import '../styles/report-visual.css'
import '../styles/care-workflow.css'

const OUTCOME_LABELS = { calm: 'Calm', restless: 'Restless', episode: 'Episode' }
// Read old era IDs and new recording IDs side by side. Never replace old IDs or
// infer past bundled listening from an era title or an unlogged personal file.
const REPORT_SONGS = [...eraCatalog, ...includedCatalog.map(recording => ({
  id: recording.id, title: recording.title, artist: recording.artist,
  recordingYear: recording.recordingYear, included: true,
}))]

// Equal-sized marks describe the record; their height and size do not score it.
function EveningMark({ outcome }) {
  return (
    <svg className={`evening-mark ${outcome || 'unlogged'}`} viewBox="0 0 32 32" aria-hidden="true">
      {outcome === 'calm' ? <circle cx="16" cy="16" r="10" />
        : outcome === 'restless' ? <path d="m16 4 12 12-12 12L4 16Z" />
          : outcome === 'episode' ? <><path d="M8 5v22M16 5v22M24 5v22" /><circle cx="16" cy="16" r="14" /></>
            : <circle cx="16" cy="16" r="10" />}
    </svg>
  )
}

function WeekRhythm({ report, example }) {
  const [year, month, day] = report.from.split('-').map(Number)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(year, month - 1, day + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const night = report.nights.find((entry) => entry.date === key)
    return { key, day: date.getDate(), outcome: night?.outcome }
  })

  return (
    <section className="week-rhythm no-print" aria-labelledby="week-rhythm-title">
      <div className="rhythm-heading">
        <h2 id="week-rhythm-title">{example ? 'An example week' : 'The shape of your week'}</h2>
        <p><strong>{report.evenings}</strong> {example ? 'example' : 'recorded'} evening{report.evenings === 1 ? '' : 's'}</p>
      </div>
      <ol className="rhythm-days" aria-label="Evening records by date">
        {days.map((entry) => (
          <li key={entry.key} aria-label={`${prettyDate(entry.key)}: ${OUTCOME_LABELS[entry.outcome] || 'Not logged'}`}>
            <span className="rhythm-mark"><EveningMark outcome={entry.outcome} /></span>
            <span aria-hidden="true">{entry.day}</span>
          </li>
        ))}
      </ol>
      <div className="rhythm-legend">
        {Object.entries(OUTCOME_LABELS).map(([outcome, label]) => (
          <span key={outcome}><EveningMark outcome={outcome} /><strong>{report.counts[outcome]}</strong> {label}</span>
        ))}
      </div>
      <p className="rhythm-caption">{example ? 'All populated marks are fictional examples. An open circle has no example entry.' : 'An open circle means an evening wasn’t logged. It does not mean nothing happened.'}</p>
    </section>
  )
}

export default function Report({ state }) {
  const { profile, logs } = state
  const hasRecorded = logs.some(log => !log.demo)
  const hasDemo = logs.some(log => log.demo)
  const [source, setSource] = useState(() => !hasRecorded && hasDemo ? 'example' : 'recorded')
  const example = source === 'example' && hasDemo
  const selectedLogs = logsForHandoff(logs, example ? 'example' : 'recorded')
  const r = weeklyReport(selectedLogs, { songs: REPORT_SONGS })
  const coverage = handoffCoverage(selectedLogs, r.from, r.to)
  const sourceName = example ? 'Fictional example preview' : 'Caregiver-recorded evenings'
  const fullDate = value => new Date(`${value}T12:00:00`).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
  const onsetTime = log => typeof log.episodeStart === 'string' && Number.isFinite(new Date(log.episodeStart).getTime())
    ? new Date(log.episodeStart).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Not recorded'

  return (
    <div className={`report care-handoff${example ? ' example-handoff' : ''}`}>
      <header className="report-heading">
        <div className="report-masthead no-print">
          <p className="report-kicker">{example ? 'Fictional demonstration' : `${profile.name}’s evening journal`}</p>
          <button className="btn report-print" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 16H4V9h16v7h-3M7 13h10v8H7zM17 11h.01" /></svg>
            {example ? 'Print example' : 'Print care handoff'}
          </button>
        </div>
        <h1 className="no-print">An evening record<br />to share.</h1>
        <h1 className="report-print-heading">{example ? 'EXAMPLE — fictional evening handoff' : `Evening care handoff for ${profile.name}`}</h1>
        <p className="muted report-dates">
          {fullDate(r.from)} to {fullDate(r.to)} · Most recent week in this view
        </p>
      </header>
      {hasDemo && <div className="handoff-source-switch no-print" role="group" aria-label="Report source">
        <button className="btn" aria-pressed={!example} onClick={() => setSource('recorded')}>Recorded evenings</button>
        <button className="btn" aria-pressed={example} onClick={() => setSource('example')}>Fictional example preview</button>
      </div>}
      <div className={`handoff-provenance${example ? ' demo-flag' : ''}`}>
        <strong>{sourceName}</strong>
        <p>{example ? 'All populated rows are fictional demo data. This is not a care record.' : 'Source: caregiver-selected evening labels and optional comfort steps. This view excludes fictional demo data.'}</p>
        <p>Prepared {new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })} · Local times: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      </div>

      <WeekRhythm report={r} example={example} />

      <section className="handoff-coverage" aria-label="Record completeness">
        <p><strong>{coverage.recorded} of 7</strong> evenings {example ? 'shown as examples' : 'recorded'} · <strong>{coverage.unrecorded}</strong> {example ? 'without an example' : 'not recorded'}.</p>
        <p>Comfort steps: {coverage.contextRecorded} entered, {coverage.contextMissing} not recorded among {coverage.recorded} {example ? 'example' : 'recorded'} evenings.</p>
        <p>Episode onset: {coverage.onsetRecorded} time{coverage.onsetRecorded === 1 ? '' : 's'} entered among {coverage.episodes} episode label{coverage.episodes === 1 ? '' : 's'}; {coverage.onsetMissing} not recorded.</p>
      </section>

      {r.evenings === 0 ? (
        <div className="report-empty">
          <p className="lead">{example ? 'No example evenings in this view.' : 'No caregiver-recorded evenings yet.'}</p>
          <p>After an evening, choose Calm, Restless, or Episode in Log. A missing entry does not mean an uneventful evening.</p>
        </div>
      ) : (
        <>
          <section className="report-grid report-print-summary">
            <div className="stat calm">
              <span className="stat-number">{r.counts.calm}</span> calm
            </div>
            <div className="stat restless">
              <span className="stat-number">{r.counts.restless}</span> restless
            </div>
            <div className="stat episode">
              <span className="stat-number">{r.counts.episode}</span> episode{r.counts.episode === 1 ? '' : 's'}
            </div>
          </section>

          <div className="report-observations">
            <section className="report-section report-onset">
              <p className="report-section-index no-print">01 / Timing</p>
              <h2>When episodes started</h2>
              <p>
                {r.onset.minutes.length === 0
                  ? 'No onset times with an available dusk estimate.'
                  : `Median recorded onset: ${r.onset.text}, using ${r.onset.minutes.length} time${r.onset.minutes.length === 1 ? '' : 's'} with a dusk estimate.`}
                {' '}Dusk is an estimate, not a measured light level. These times do not predict a future episode.
              </p>
            </section>

            <section className="report-section report-weather">
              <p className="report-section-index no-print">02 / The sky</p>
              <h2>Cloudy vs clear evenings</h2>
              <p>
                Cloudy: {r.cloudy.episodes} episode{r.cloudy.episodes === 1 ? '' : 's'} in {r.cloudy.evenings} evening
                {r.cloudy.evenings === 1 ? '' : 's'}.
                <br />
                Clear: {r.clear.episodes} episode{r.clear.episodes === 1 ? '' : 's'} in {r.clear.evenings} evening
                {r.clear.evenings === 1 ? '' : 's'}.
                {coverage.weatherMissing > 0 && <><br />Weather was unavailable for {coverage.weatherMissing} evening{coverage.weatherMissing === 1 ? '' : 's'}.</>}
                <br />Forecast groups describe the record; they do not establish a cause.
              </p>
            </section>
          </div>

          <section className="report-section report-songs">
            <p className="report-section-index no-print">03 / Familiar sounds</p>
            <h2>Recorded music activity</h2>
            <p className="small">Recorded song activity and evening labels; this does not show that a song caused a change. Older song selections may not represent confirmed playback. Missing activity is not evidence of no music or no listening.</p>
            {r.topSongs.length === 0 ? (
              <p>No song activity recorded this week.</p>
            ) : (
              <ol className="top-songs">
                {r.topSongs.map((s) => (
                  <li key={s.id}>
                    <span className="report-song-title">{s.title}</span> <span className="muted report-song-artist">· {s.artist}{s.included ? ` · Included recording${s.recordingYear ? ` (${s.recordingYear})` : ''}` : `, ${s.year}`}</span>
                    <span className="report-song-count">{s.plays} logged evening{s.plays === 1 ? '' : 's'} · {s.calm} calm, {s.restless} restless, {s.episode} episode{s.episode === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="report-section report-records">
            <p className="report-section-index no-print">04 / Your notes</p>
            <h2>Night by night</h2>
            <p className="handoff-record-key">Labels and comfort steps are caregiver-reported{example ? ' in this fictional example' : ''}. “Not recorded” is different from “none of the listed steps.” No label is a clinical assessment.</p>
            <table className="nights">
              <thead><tr><th scope="col">Evening / source</th><th scope="col">Observation</th><th scope="col">Onset (local)</th><th scope="col">Comfort steps used</th></tr></thead>
              <tbody>
                {coverage.nights.map(({ date, log }) => (
                  <tr key={date}>
                    <th scope="row">{prettyDate(date)}<span className="handoff-row-source">{log ? example ? 'Fictional example' : 'Caregiver record' : example ? 'No example' : 'No entry'}</span></th>
                    <td data-label="Observation" className={`outcome-cell ${log?.outcome || 'unlogged'}`}>{log ? OUTCOME_LABELS[log.outcome] : 'Not recorded'}</td>
                    <td data-label="Onset">{!log ? 'Not recorded' : log.outcome === 'episode' ? onsetTime(log) : 'Not entered for this label'}</td>
                    <td data-label="Comfort">{comfortStepsText(log?.careContext)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className="doctor-note">{CARE_PLAN_NOTE}</p>
      <p className="muted small handoff-limits">Caregiver-support prototype. Not clinically validated; not a diagnosis, treatment recommendation, or monitored alert service. This handoff is prepared on this device; printing does not send it to a care team.</p>
    </div>
  )
}
