import { bundledMusic } from './bundledMusic.js'
import useOfflineAudioStatus from './useOfflineAudioStatus.js'

export default function DeviceReadiness() {
  const { online, known, readyCount, downloading, requestDownload } = useOfflineAudioStatus(bundledMusic)
  const complete = known && readyCount === bundledMusic.length
  return <section className="card device-readiness" aria-labelledby="device-heading">
    <p className="eyebrow">Ready when you are</p>
    <h2 id="device-heading">This device</h2>
    <div className={`device-meter ${complete ? 'is-ready' : ''}`}>
      <span aria-hidden="true">{complete ? '✓' : '↓'}</span>
      <div><strong>{known ? `${readyCount} of ${bundledMusic.length} recordings` : 'Checking saved music'}</strong>
        <p>{complete ? 'Saved for offline listening' : known ? 'Saved for offline listening so far' : 'Offline availability is not confirmed yet'}</p></div>
    </div>
    {!complete && <>
      <p className="muted">{online ? 'Keep Moonrise open while music downloads. The piano recording saves first.' : 'Reconnect to save more recordings. A recording is ready only after its download finishes.'}</p>
      <button className="btn" onClick={requestDownload} disabled={!online || downloading}>
        {downloading ? 'Saving music…' : 'Save music for offline use'}
      </button>
    </>}
    <p className="device-rehearsal">Before relying on this device, open Moonrise without a connection and try your chosen recording. Browsers can remove saved files.</p>
    <details className="settings-disclosure">
      <summary>What works without a connection?</summary>
      <p>Your saved profile, selected conversation starters, journal and downloaded music remain on this browser. New suggestions and live weather need a connection.</p>
      <p>The evening plan uses an offline sunset estimate when live weather is unavailable. This is a planning cue, not a health alert.</p>
    </details>
  </section>
}
