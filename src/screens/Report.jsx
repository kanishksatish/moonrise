import { weeklyReport } from '../engine/index.js'
import { prettyDate } from '../components/format.js'

export default function Report({ state }) {
  const { profile, logs } = state
  const r = weeklyReport(logs)
  const weekLogs = logs.filter((l) => l.date >= r.from && l.date <= r.to)
  const hasDemo = weekLogs.some((l) => l.demo)
  const unknownWeather = weekLogs.filter((l) => !Number.isFinite(l.cloudCover)).length

  return (
    <div className="report">
      <div className="report-actions no-print">
        <button className="btn primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <h1>Evening report for {profile.name}</h1>
      <p className="muted">
        {prettyDate(r.from)} to {prettyDate(r.to)} · {r.evenings} evening{r.evenings === 1 ? '' : 's'} logged
      </p>
      {hasDemo && <p className="demo-flag">Includes demo data, not real evenings.</p>}

      {r.evenings === 0 ? (
        <p className="lead">No evenings logged this week yet.</p>
      ) : (
        <>
          <section className="report-grid">
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

          <section>
            <h2>When episodes started</h2>
            <p>
              {r.onset.minutes.length === 0
                ? 'No episode times were logged.'
                : `Usually ${r.onset.text} (middle of ${r.onset.minutes.length} logged time${r.onset.minutes.length === 1 ? '' : 's'}).`}
            </p>
          </section>

          <section>
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

          <section>
            <h2>Songs from your evenings</h2>
            <p className="small">Based on your logs and opened song links; this does not show that a song caused a change.</p>
            {r.topSongs.length === 0 ? (
              <p>No song links recorded this week.</p>
            ) : (
              <ol className="top-songs">
                {r.topSongs.map((s) => (
                  <li key={s.id}>
                    {s.title} <span className="muted">· {s.artist}, {s.year}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h2>Night by night</h2>
            <table className="nights">
              <thead><tr><th scope="col">Evening</th><th scope="col">Outcome</th><th scope="col">Onset</th><th scope="col">Cloud</th></tr></thead>
              <tbody>
                {r.nights.map((n) => (
                  <tr key={n.date}>
                    <th scope="row">{prettyDate(n.date)}</th>
                    <td className={`outcome-cell ${n.outcome}`}>{n.outcome}</td>
                    <td>{n.onsetText ?? ''}</td>
                    <td>{Number.isFinite(n.cloudCover) ? `${Math.round(n.cloudCover)}% cloud` : ''}</td>
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
