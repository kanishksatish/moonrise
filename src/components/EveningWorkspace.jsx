import { useEffect, useRef, useState } from 'react'
import { normalizeEveningPlan } from '../engine/eveningSession.js'
import '../styles/evening-workspace.css'
import ComfortPhoto from './ComfortPhoto.jsx'
import { deleteComfortPhoto, saveComfortPhoto, validateComfortPhotoFile } from '../engine/comfortPhoto.js'

export const ACTIVITY_LABELS = { story: 'A familiar story', music: 'A little music', quiet: 'Quiet company' }
const PREVIEWS = { story: 'Open the saved photo and story, or a conversation starter.', music: 'Open the listening library and play a recording in the app.', quiet: 'Open a quiet screen with music stopped.' }
const ICONS = { story: '◇', music: '♫', quiet: '◌' }

export const EXAMPLE_PLAN = {
  preferredName: 'Avery (fictional)', familiarPlace: 'The kitchen garden',
  story: 'Avery’s family describes Sunday mornings in the garden, picking tomatoes for lunch.',
  caregiverCue: 'Offer the garden story first. Read the caption together; there is no need to remember an answer.',
  avoid: 'The example family asks us to avoid questions about dates.', activities: ['story', 'music', 'quiet'],
}

export default function EveningWorkspace({ profile, plan: raw, onSave, onStart, saveError, startTime }) {
  const plan = normalizeEveningPlan(raw)
  const [draft, setDraft] = useState(plan)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(plan.activities[0] || 'quiet')
  const [status, setStatus] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('')
  const prepareButton = useRef(null)
  const pendingPhotos = useRef(new Set())
  const mounted = useRef(true)
  const photoRequest = useRef(0)
  const name = plan.preferredName || profile.name
  const firstActivity = plan.activities.includes(selected) ? selected : plan.activities[0] || 'quiet'
  async function discardPendingPhotos() {
    await Promise.all([...pendingPhotos.current].map(async id => {
      await deleteComfortPhoto(id)
      pendingPhotos.current.delete(id)
    }))
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      photoRequest.current += 1
      discardPendingPhotos().catch(() => { /* Storage may be unavailable while leaving. */ })
    }
  }, [])
  function field(key, value) { setDraft(previous => ({ ...previous, [key]: value })); setStatus('') }
  function closePreparation() {
    photoRequest.current += 1
    setEditing(false); setDraft(plan); setPhotoStatus(''); setStatus('')
    discardPendingPhotos().catch(() => {
      if (mounted.current) setStatus('This device could not remove an unused draft photo. Try opening and closing preparation again.')
    })
    prepareButton.current?.focus()
  }
  function save(event) {
    event.preventDefault()
    if (photoBusy) return
    const nextPlan = normalizeEveningPlan(draft)
    // App retains a submitted plan in memory even if browser persistence fails.
    // Its photo must be retained from the moment onSave receives the plan.
    pendingPhotos.current.delete(nextPlan.photoId)
    const saved = onSave(nextPlan)
    setStatus(saved ? 'Your evening plan is saved on this device.' : 'Your plan is available now, but could not be saved. Keep this page open and retry.')
    if (saved) { setEditing(false); prepareButton.current?.focus() }
  }
  async function choosePhoto(event) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    const request = ++photoRequest.current
    setPhotoBusy(true); setPhotoStatus('Preparing a smaller, on-device copy…')
    try {
      validateComfortPhotoFile(file)
      const replacingDraft = pendingPhotos.current.has(draft.photoId)
      await discardPendingPhotos()
      if (!mounted.current || request !== photoRequest.current) return
      if (replacingDraft) field('photoId', '')
      const { id } = await saveComfortPhoto(file)
      pendingPhotos.current.add(id)
      if (!mounted.current || request !== photoRequest.current) {
        await deleteComfortPhoto(id)
        pendingPhotos.current.delete(id)
        return
      }
      field('photoId', id)
      setPhotoStatus('Photo ready. Save the evening plan to use it. Nothing was uploaded.')
    } catch (error) {
      if (mounted.current && request === photoRequest.current) setPhotoStatus(error.message || 'The photo could not be saved. Your written plan is still available.')
    } finally {
      if (mounted.current && request === photoRequest.current) setPhotoBusy(false)
      input.value = ''
    }
  }
  function removePhoto() {
    field('photoId', '')
    discardPendingPhotos().catch(() => {
      if (mounted.current) setPhotoStatus('This device could not remove the unused draft photo. Try closing preparation again.')
    })
  }
  return <section className="evening-workspace" aria-label="Prepare your evening">
    <header className="evening-workspace__hero">
      <p className="eyebrow">Moonrise</p>
      <h1>Evening care<br/><em>for {name}.</em></h1>
      <p>Support for caregivers navigating sundowning. Choose an activity and keep a record for the next caregiver.</p>
      {startTime && <div className="evening-workspace__meta"><span>Suggested start {startTime}</span></div>}
    </header>
    <div className="evening-workspace__layout">
      <section className="evening-plan-card" aria-label={`Prepared evening for ${name}`}>
        <h2>Choose an activity</h2>
        <div className="evening-choices" role="group" aria-label="Choose your first activity">
          {(plan.activities.length ? plan.activities : ['quiet']).map(activity => <button key={activity} className={firstActivity === activity ? 'selected' : ''} aria-label={ACTIVITY_LABELS[activity]} aria-pressed={firstActivity === activity} aria-describedby="activity-preview" onClick={() => setSelected(activity)}><span className="activity-icon" aria-hidden="true">{ICONS[activity]}</span>{{story:'Story', music:'Music', quiet:'Quiet'}[activity]}</button>)}
        </div>
        <div id="activity-preview" className="activity-preview" role="status"><p key={firstActivity}>{PREVIEWS[firstActivity]}</p></div>
        <button className="btn primary evening-workspace__start" onClick={() => onStart(firstActivity)}><span>Start Moonrise now</span><span aria-hidden="true">↗</span></button>
<p className="evening-plan-card__quote">{plan.story || 'Add a story or photo in the profile to use it during a session.'}</p>
        <ComfortPhoto id={plan.photoId} alt={plan.familiarPlace || 'Photo selected for this evening'}/>
      </section>
      <aside className="evening-person-card" aria-label="Personal context">
        <span className="evening-person-card__initial" aria-hidden="true">{name.trim().slice(0, 1)}</span>
        <p className="eyebrow">Personal profile</p><h2>{plan.familiarPlace || 'Stories and preferences'}</h2>
        <p>{plan.caregiverCue || 'Add a photo, story, caregiver notes and topics to avoid.'}</p>
        {plan.avoid && <p><strong>Keep in mind</strong><br/>{plan.avoid}</p>}
        <button ref={prepareButton} className="btn" disabled={photoBusy} onClick={() => { if (editing) closePreparation(); else { setDraft(plan); setEditing(true); setStatus(''); setPhotoStatus('') } }} aria-expanded={editing}>{editing ? 'Close preparation' : 'Prepare their evening'} <span aria-hidden="true">↗</span></button>
      </aside>
    </div>
    {editing && <section className="evening-preparation" aria-label="Evening plan editor">
      <p className="eyebrow">A few personal details</p><h2>Help the next caregiver know them.</h2>
      <p>Use words the person or family has shared. These details stay in this browser and are not sent for generation.</p>
      <form className="evening-form" onSubmit={save}>
        <label>Preferred name<input value={draft.preferredName} maxLength={60} onChange={e => field('preferredName', e.target.value)}/></label>
        <label>A familiar place or interest<input value={draft.familiarPlace} maxLength={160} onChange={e => field('familiarPlace', e.target.value)}/></label>
        <label>A short story to share<textarea rows={3} value={draft.story} maxLength={1200} onChange={e => field('story', e.target.value)}/></label>
        <div className="evening-photo-editor"><label>A familiar photo <span>Optional · JPEG, PNG or WebP, up to 8 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={choosePhoto}/></label><p>Choose a photo you have permission to use. A smaller copy stays on this device, including for past sessions; it is never sent for generation.</p><ComfortPhoto id={draft.photoId} alt="Photo selected for the evening plan"/>{draft.photoId && <button className="btn" type="button" disabled={photoBusy} onClick={removePhoto}>Remove from this plan</button>}{photoStatus && <p role="status">{photoStatus}</p>}</div>
        <label>A note for the caregiver<textarea rows={3} value={draft.caregiverCue} maxLength={400} onChange={e => field('caregiverCue', e.target.value)}/></label>
        <label>Topics or activities to avoid<textarea rows={2} value={draft.avoid} maxLength={300} onChange={e => field('avoid', e.target.value)}/></label>
        <fieldset><legend>Activities to prepare</legend>{Object.entries(ACTIVITY_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.activities.includes(key)} onChange={event => field('activities', event.target.checked ? [...draft.activities, key] : draft.activities.filter(activity => activity !== key))}/>{label}</label>)}<p>Unchecked activities are left out of the prepared choices. Quiet remains available during every session.</p></fieldset>
        <div className="evening-form__actions"><button className="btn primary" type="submit" disabled={photoBusy}>Save evening plan</button><button className="btn" type="button" disabled={photoBusy} onClick={closePreparation}>Cancel</button></div>
      </form>
    </section>}
    {status && <p role="status">{status}</p>}

    <details className="sky-facts evening-explanation"><summary>Why focus on the evening?</summary><p>Some people living with dementia experience more confusion or distress later in the day, often called sundowning. Moonrise helps a caregiver prepare familiar activities and record what happened. It does not predict episodes or determine what caused a change.</p><p>Follow the person’s care plan for new or concerning changes. Music, conversation and quiet company are optional.</p></details>
    <div className="evening-latest"><div><p className="eyebrow">Explore without changing your records</p><h2>One fictional evening.</h2><p>Follow Avery’s garden story, change the activity, and see the session handoff. Example sessions stay separate.</p></div><button className="btn" onClick={() => onStart('story', true)}>Try a fictional session <span aria-hidden="true">↗</span></button></div>
  </section>
}
