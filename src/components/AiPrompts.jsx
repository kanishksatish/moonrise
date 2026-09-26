import { useEffect, useRef, useState } from 'react'
import { AiPromptError, clearAiKey, generateMemoryPrompts, loadAiKey, saveAiKey } from '../engine/index.js'

// Drafts stay in this screen's memory. Only an explicit approval enters app state.
export default function AiPrompts({ state, update, generatePrompts = generateMemoryPrompts }) {
  const [savedKey, setSavedKey] = useState(loadAiKey)
  const [keyDraft, setKeyDraft] = useState('')
  const [drafts, setDrafts] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef(0)
  const inFlight = useRef(false)
  const approved = state.approvedPrompts ?? []

  useEffect(() => () => { request.current += 1 }, [])

  function saveKey(event) {
    event.preventDefault()
    const key = keyDraft.trim()
    if (!key) return
    if (!saveAiKey(key)) {
      setError('This browser could not save the key. Check that site storage is allowed.')
      return
    }
    setSavedKey(key)
    setKeyDraft('')
    setError('')
    setMessage('Key saved. Nothing is sent until you tap Generate prompts.')
  }

  function removeKey() {
    if (!clearAiKey()) {
      setError('This browser could not remove the key. Clear Moonrise site data in your browser settings.')
      return
    }
    setSavedKey('')
    setKeyDraft('')
    setError('')
    setMessage('Key removed. Your approved prompts are still available.')
  }

  async function generate() {
    if (inFlight.current || !savedKey) return
    inFlight.current = true
    const id = ++request.current
    setBusy(true)
    setError('')
    setMessage('Writing a few prompts for you to review…')
    try {
      const prompts = await generatePrompts(state.profile, { apiKey: savedKey, existing: approved })
      if (id !== request.current) return
      setDrafts(prompts)
      setMessage(prompts.length
        ? `${prompts.length} drafts ready. Read each one and choose what feels right for your person.`
        : 'No new prompts to review. Your built-in and approved prompts are still available.')
    } catch (err) {
      if (id !== request.current) return
      setMessage('')
      setError(err instanceof AiPromptError ? err.message : 'Could not reach the AI service. Your built-in prompts still work; try again when connected.')
    } finally {
      if (id === request.current) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }

  function review(text, keep) {
    if (keep) update({ ...state, approvedPrompts: [...new Set([...approved, text])] })
    setDrafts(current => current.filter(draft => draft !== text))
    setMessage(keep ? 'Prompt approved for your next routine.' : 'Prompt skipped.')
  }

  return (
    <section className="card ai-prompts" aria-labelledby="ai-heading">
      <p className="eyebrow">A little more personal</p>
      <h2 id="ai-heading">AI memory prompts <span className="muted">(optional)</span></h2>
      <p>Let Claude draft gentle conversation starters. You choose which ones belong in your routine.</p>
      <p className="muted">Built-in prompts always work without AI. Nothing new enters Moonrise mode until you approve it.</p>

      <details className="ai-key-details">
        <summary>{savedKey ? 'API key saved · manage key' : 'Set up your API key'}</summary>
        <p className="muted">Uses your own Anthropic API credits. The key is saved in this browser. Remove it after using a shared device.</p>
        <form onSubmit={saveKey}>
          <label className="field">
            <span>{savedKey ? 'Replace Anthropic API key' : 'Anthropic API key'}</span>
            <input type="password" value={keyDraft} onChange={event => setKeyDraft(event.target.value)}
              autoComplete="off" autoCapitalize="none" spellCheck="false" disabled={busy} />
          </label>
          <div className="ai-actions">
            <button className="btn" type="submit" disabled={!keyDraft.trim() || busy}>Save key</button>
            {savedKey && <button className="btn" type="button" onClick={removeKey} disabled={busy}>Remove key</button>}
          </div>
        </form>
      </details>

      <p id="ai-privacy" className="muted">When you tap Generate, your birth year and any hometown, spouse and job answers go to Anthropic. Your profile name, coordinates and evening logs are not sent.</p>
      <button className="btn primary" onClick={generate} disabled={!savedKey || busy || drafts.length > 0}
        aria-describedby="ai-privacy">{busy ? 'Writing prompts…' : 'Generate prompts'}</button>
      {!savedKey && <p className="muted">Add a key above to generate prompts.</p>}
      {message && <p className="status" role="status">{message}</p>}
      {error && <p className="status" role="alert">{error}</p>}

      {drafts.length > 0 && <div className="ai-review">
        <h3>Review before sharing</h3>
        <p className="muted">AI can get things wrong. Skip anything inaccurate, uncomfortable or likely to feel like a memory test.</p>
        <ul className="ai-prompt-list">
          {drafts.map((text, index) => <li key={text}>
            <p>{text}</p>
            <div className="ai-actions">
              <button className="btn primary" onClick={() => review(text, true)} aria-label={`Approve prompt ${index + 1}`}>Approve</button>
              <button className="btn" onClick={() => review(text, false)} aria-label={`Skip prompt ${index + 1}`}>Skip</button>
            </div>
          </li>)}
        </ul>
      </div>}

      {approved.length > 0 && <div className="ai-approved">
        <h3>Approved for your routine ({approved.length})</h3>
        <p className="muted">AI-written, reviewed by you. Saved on this device and available offline.</p>
        <ul className="ai-prompt-list">
          {approved.map((text, index) => <li key={`${index}-${text}`}>
            <p>{text}</p>
            <button className="btn" disabled={busy} aria-label={`Remove approved prompt ${index + 1}`}
              onClick={() => {
                update({ ...state, approvedPrompts: approved.filter((_, i) => i !== index) })
                setMessage('Approved prompt removed.')
              }}>Remove</button>
          </li>)}
        </ul>
      </div>}
    </section>
  )
}
