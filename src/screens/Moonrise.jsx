import { useEffect, useId, useState } from 'react'
import MusicPlayer from '../components/MusicPlayer.jsx'
import Brand from '../components/Brand.jsx'
import { memoryPrompts, playlist, promptAt, songVideo } from '../engine/index.js'
import { normalizeEveningPlan } from '../engine/eveningSession.js'
import { ACTIVITY_LABELS } from '../components/EveningWorkspace.jsx'
import { eveningKey } from '../components/eveningLog.js'
import '../styles/session-studio.css'
import recordingCatalog from '../assets/audio/catalog.json'
import ComfortPhoto from '../components/ComfortPhoto.jsx'
import SkyStage from '../components/SkyStage.jsx'
import useNow from '../components/useNow.js'
import '../styles/sky-stage.css'

const PROMPT_STEP_MS = 3 * 60000

export default function Moonrise({ state, session, onSessionEvent = () => {}, onPlayed, onExit, saveError = false }) {
  const contextProfile = session?.isDemo ? { name: 'Avery (fictional)', birthYear: 1942, anchors: {} } : state.profile
  const plan = normalizeEveningPlan(session?.plan || state.eveningPlan)
  const [activity, setActivity] = useState(session?.events?.find(event => event.type === 'offered')?.activity || 'music')
  const [promptOffset, setPromptOffset] = useState(0)
  const now = useNow(10000)
  const [note, setNote] = useState('')
  const [noteStatus, setNoteStatus] = useState('')
  const [startedAt] = useState(() => Date.now())
  const [acknowledged, setAcknowledged] = useState(false)
  const [previousActivity, setPreviousActivity] = useState(() => plan.activities.find(value => value !== 'quiet') || 'quiet')
  const quietHelp = useId()
  const [songs] = useState(() => playlist(contextProfile.birthYear, session?.isDemo ? [] : state.logs).filter(item => songVideo(item.id)))
  const [songIndex, setSongIndex] = useState(0)
  const song = songs.length ? songs[songIndex % songs.length] : null
  // The recording actually playing, shown on the shared stage; cleared when playback stops.
  const [nowPlaying, setNowPlaying] = useState(null)
  useEffect(() => {
    let lock; let disposed = false
    const release = async value => { try { await value?.release() } catch { /* Device may already have released it. */ } }
    navigator.wakeLock?.request?.('screen').then(value => { if (disposed) release(value); else lock = value }).catch(() => {})
    return () => { disposed = true; release(lock) }
  }, [])
  const prompts = memoryPrompts(contextProfile, { approved: session?.isDemo ? [] : state.approvedPrompts })
  // One prompt at a time, rotating every few minutes; Next prompt moves ahead one step.
  const prompt = promptAt(prompts, now.getTime() - startedAt + promptOffset * PROMPT_STEP_MS)
  const name = session?.displayName || plan.preferredName || state.profile.name
  const playedSongIds = !session && state.tonight?.date === eveningKey() ? state.tonight.songIds : []
  const title = activity === 'story' ? plan.familiarPlace || 'Conversation' : activity === 'music' ? 'Music' : 'Quiet'
  const returnActivity = plan.activities.includes(previousActivity) && previousActivity !== 'quiet' ? previousActivity : plan.activities.find(value => value !== 'quiet')
  function changeActivity(next) {
    if (next === activity) return
    if (next === 'quiet') setPreviousActivity(activity)
    if (acknowledged) onSessionEvent({ type: 'stopped', activity })
    onSessionEvent({ type: 'offered', activity: next })
    setActivity(next); setAcknowledged(false)
  }
  function decline() {
    onSessionEvent({ type: 'declined', activity })
    setActivity('quiet'); setAcknowledged(false)
    if (activity !== 'quiet') onSessionEvent({ type: 'offered', activity: 'quiet' })
  }
  function saveNote(event) {
    event.preventDefault()
    if (!note.trim()) return
    onSessionEvent({ type: 'observation', text: note.trim() })
    setNote(''); setNoteStatus('Observation added to this session. It describes what you noticed, not what caused it.')
  }
  return <div className={`session-studio activity-${activity}`}>
    <header className="studio-header"><Brand/><div><button className="btn" autoFocus disabled={activity === 'quiet' && !returnActivity} aria-pressed={activity === 'quiet'} aria-describedby={quietHelp} onClick={() => changeActivity(activity === 'quiet' ? returnActivity : 'quiet')}>{activity === 'quiet' ? returnActivity === 'music' ? 'Return to music' : returnActivity ? 'Show conversation' : 'Quiet view' : 'Quiet view'}</button><button className="btn studio-finish" onClick={() => { if (note.trim()) { setNoteStatus('Add or clear your observation before finishing.'); return } if (acknowledged) onSessionEvent({ type: 'stopped', activity }); onExit() }}>Finish <span aria-hidden="true">↗</span></button></div><p id={quietHelp} className="sr-only">Stops music and hides the conversation for quiet company. Returning will not start music automatically.</p></header>
    {session?.isDemo && <p className="studio-demo">Fictional session · separate from your observations</p>}
    {saveError && <p role="alert" className="studio-warning">This device could not save your changes. Keep this page open; changes may be lost when you close it.</p>}
    <main className="studio-layout">
      <section className="studio-stage" aria-label="Shared activity">
        <SkyStage now={now} startedAt={startedAt} lat={state.profile?.lat} lon={state.profile?.lon}/>
        <p className="eyebrow">{name}</p>
        <div className="studio-stage__content">{activity === 'story' && plan.photoId ? <ComfortPhoto id={plan.photoId} alt={plan.familiarPlace || 'Photo selected by the caregiver'}/> : <span className="studio-orbit" aria-hidden="true">{activity === 'music' ? '♫' : activity === 'story' ? '◇' : '◌'}</span>}<p className="studio-stage__label">{ACTIVITY_LABELS[activity]}</p><h1>{title}</h1>
        {activity === 'story' && <><p className="studio-stage__label">{plan.story ? 'Shared by the caregiver' : 'Conversation starter'}</p><p className="studio-story prompt-text">{plan.story || prompt || 'Conversation starter unavailable.'}</p></>}
        {activity === 'music' && (nowPlaying ? <div className="studio-era" aria-live="polite">
          <p className="studio-stage__label">Now playing</p>
          <p className="studio-era-title">{nowPlaying}</p>
        </div> : <p className="studio-story">Choose a recording from the library.</p>)}
        {activity === 'quiet' && <p className="studio-story">Music is stopped.</p>}
        </div>
      </section>
      <aside className="studio-caregiver" aria-label="Caregiver controls">
        <h2>Session controls</h2>{plan.avoid && <p className="studio-preference"><strong>Keep in mind:</strong> {plan.avoid}</p>}
        <div className="studio-choices" role="group" aria-label="Shared activity choices">{Object.entries(ACTIVITY_LABELS).filter(([key]) => key === 'quiet' || plan.activities.includes(key)).map(([key, label]) => <button key={key} className="btn" aria-pressed={activity === key} onClick={() => changeActivity(key)}>{label}</button>)}</div>
        {activity === 'music' && <><MusicPlayer song={song} youtubeId={song ? songVideo(song.id)?.youtubeId : null} onNext={songs.length > 1 ? () => setSongIndex(i => i + 1) : undefined} sessionId={session?.id || startedAt} playedSongIds={playedSongIds} onStopped={() => { onSessionEvent({ type: 'stopped', activity: 'music', source: 'player' }); setAcknowledged(false); setNowPlaying(null) }} onPlayback={id => { const label = id ? recordingCatalog.find(item => item.id === id)?.title || 'Catalog recording' : 'A music file from this device'; setAcknowledged(true); setNowPlaying(label); onSessionEvent({ type: 'started', activity: 'music', source: 'player', text: id ? `Recording: ${label}` : label }) }} onPlayed={onPlayed}/><details className="studio-cue" open><summary>Conversation starter</summary><p className="prompt-text">{prompt}</p><button className="btn" onClick={() => setPromptOffset(offset => offset + 1)}>Next prompt</button></details></>}
        {activity === 'story' && !plan.story && <button className="btn" onClick={() => setPromptOffset(offset => offset + 1)}>Next prompt</button>}
        <div className="studio-actions">
          {activity !== 'music' && <button className="btn primary" disabled={acknowledged} onClick={() => { onSessionEvent({ type: 'started', activity }); setAcknowledged(true) }}>{acknowledged ? 'Started in the session record' : 'Record that we started'}</button>}
          <button className="btn" onClick={decline}>They declined this activity</button>
        </div>
        {(plan.caregiverCue || plan.avoid) && <details className="studio-cue"><summary>Prepared caregiver notes</summary>{plan.caregiverCue && <p>{plan.caregiverCue}</p>}{plan.avoid && <p><strong>Keep in mind:</strong> {plan.avoid}</p>}</details>}
        <form className="studio-note" onSubmit={saveNote}><label htmlFor="session-observation">What did you notice? <span>Optional</span></label><textarea id="session-observation" value={note} maxLength={500} rows={3} placeholder="Describe only what you observed." onChange={event => { setNote(event.target.value); setNoteStatus('') }}/><button className="btn" type="submit" disabled={!note.trim()}>Add observation</button>{note.trim() && <button className="btn" type="button" onClick={() => { setNote(''); setNoteStatus('Draft cleared. Nothing was added to the record.') }}>Clear draft</button>}{noteStatus && <p role="status">{noteStatus}</p>}</form>
        <p className="studio-footnote">Follow their care plan for new or concerning changes. Moonrise is not a monitored alert service.</p>
      </aside>
    </main>
  </div>
}
