import { weeklyReport } from '../engine/index.js'
import { prettyDate } from '../components/format.js'
import '../styles/report-visual.css'

const OUTCOME_LABELS = { calm: 'Calm', restless: 'Restless', episode: 'Episode' }

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

function WeekRhythm({ report }) {
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
        <h2 id="week-rhythm-title">The shape of your week</h2>
        <p><strong>{report.evenings}</strong> evening{report.evenings === 1 ? '' : 's'} recorded</p>
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
      <p className="rhythm-caption">An open circle means an evening wasn’t logged. Every recorded evening adds context.</p>
    </section>
  )
}

export default function Report({ state }) {
  const { profile, logs } = state
  const r = weeklyReport(logs)
  const weekLogs = logs.filter((l) => l.date >= r.from && l.date <= r.to)
  const hasDemo = weekLogs.some((l) => l.demo)
  const unknownWeather = weekLogs.filter((l) => !Number.isFinite(l.cloudCover)).length

  return (
    <div className="report">
      <header className="report-heading">
        <div className="report-masthead no-print">
          <p className="report-kicker">{profile.name}’s evening journal</p>
          <button className="btn report-print" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 16H4V9h16v7h-3M7 13h10v8H7zM17 11h.01" /></svg>
            Print report
          </button>
        </div>
        <h1 className="no-print">A week of evenings.</h1>
        <h1 className="report-print-heading">Evening report for {profile.name}</h1>
        <p className="muted report-dates">
          {prettyDate(r.from)} to {prettyDate(r.to)}<span className="report-print-total"> · {r.evenings} evening{r.evenings === 1 ? '' : 's'} logged</span>
        </p>
      </header>
      {hasDemo && <p className="demo-flag">Includes demo data, not real evenings.</p>}

      <WeekRhythm report={r} />

      {r.evenings === 0 ? (
        <div className="report-empty">
          <p className="lead">No evenings logged this week yet.</p>
          <p className="no-print">After an evening, choose Calm, Restless, or Episode in Log. Your notes will appear here, ready to share.</p>
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
                  ? 'No episode times were logged.'
                  : `Usually ${r.onset.text} (middle of ${r.onset.minutes.length} logged time${r.onset.minutes.length === 1 ? '' : 's'}).`}
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
                {unknownWeather > 0 && <><br />Weather was unavailable for {unknownWeather} evening{unknownWeather === 1 ? '' : 's'}.</>}
              </p>
            </section>
          </div>

          <section className="report-section report-songs">
            <p className="report-section-index no-print">03 / Familiar sounds</p>
            <h2>Songs from your evenings</h2>
            <p className="small">Based on your logs and opened song links; this does not show that a song caused a change.</p>
            {r.topSongs.length === 0 ? (
              <p>No song links recorded this week.</p>
            ) : (
              <ol className="top-songs">
                {r.topSongs.map((s) => (
                  <li key={s.id}>
                    <span className="report-song-title">{s.title}</span> <span className="muted report-song-artist">· {s.artist}, {s.year}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="report-section report-records">
            <p className="report-section-index no-print">04 / Your notes</p>
            <h2>Night by night</h2>
            <table className="nights">
              <thead><tr><th scope="col">Evening</th><th scope="col">Outcome</th><th scope="col">Onset</th><th scope="col">Cloud</th></tr></thead>
              <tbody>
                {r.nights.map((n) => (
                  <tr key={n.date}>
                    <th scope="row">{prettyDate(n.date)}</th>
                    <td data-label="Outcome" className={`outcome-cell ${n.outcome}`}>{n.outcome}</td>
                    <td data-label="Onset">{n.onsetText ?? <span className="no-print">{n.outcome === 'episode' ? 'Not recorded' : '—'}</span>}</td>
                    <td data-label="Cloud">{Number.isFinite(n.cloudCover) ? `${Math.round(n.cloudCover)}% cloud` : <span className="no-print">Unavailable</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className="doctor-note">{r.doctorNote}</p>
      <p className="muted small">{r.supportNote}</p>
    </div>
  )
}
