import { useEffect, useRef, useState } from 'react'
import { AiPromptError, clearAiKey, generateMemoryPrompts, loadAiKey, saveAiKey } from '../engine/index.js'
import { generateLocalPrompts, localAiStatus } from './localAi.js'

// Drafts stay in this screen's memory. Only an explicit approval enters app state.
export default function AiPrompts({ state, update, generatePrompts = generateMemoryPrompts }) {
  const [savedKey, setSavedKey] = useState(loadAiKey)
  const [local, setLocal] = useState(null)
  const [connectionChecked, setConnectionChecked] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [drafts, setDrafts] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef(0)
  const inFlight = useRef(false)
  const approved = state.approvedPrompts ?? []

  useEffect(() => {
    let live = true
    let check = 0
    const refresh = () => {
      const id = ++check
      setConnectionChecked(false)
      return localAiStatus().then(status => {
        if (live && id === check) { setLocal(status); setConnectionChecked(true) }
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { live = false; request.current += 1; window.removeEventListener('focus', refresh) }
  }, [])
  const canGenerate = connectionChecked && (local ? local.configured : Boolean(savedKey))

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
    if (inFlight.current || !canGenerate) return
    inFlight.current = true
    const id = ++request.current
    setBusy(true)
    setError('')
    setMessage('Writing a few prompts for you to review…')
    try {
      const prompts = local
        ? await generateLocalPrompts(state.profile, { existing: approved })
        : await generatePrompts(state.profile, { apiKey: savedKey, existing: approved })
      if (id !== request.current) return
      setDrafts(prompts)
      setMessage(prompts.length
        ? `${prompts.length} drafts ready. Read each one and choose what feels right for your person.`
        : 'No new prompts to review. Your built-in and approved prompts are still available.')
    } catch (err) {
      if (id !== request.current) return
      setMessage('')
      setError(err instanceof AiPromptError ? err.message.replace('the AI service', 'the suggestion service') : 'Could not create suggestions right now. Your saved conversation starters still work; try again when connected.')
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
      <p className="eyebrow">Words worth sharing</p>
      <h2 id="ai-heading">Conversation starters</h2>
      <p>A familiar place. A favorite sound. Choose the invitations that feel right for your person.</p>
      <p className="muted">Optional suggestions, always reviewed by you. Built-in starters are ready without a connection.</p>

      {local ? <details className="ai-key-details">
        <summary>{local.configured ? 'Suggestion connection · manage' : 'Connect optional suggestions'}</summary>
        <p>Drafts are generated with OpenAI and may contain mistakes. A connected key is checked when you generate, not when it is saved.</p>
        <p className="muted">The key stays in this laptop’s local server memory. Disconnect on the connection page or stop the server to remove it; clearing browser data does not disconnect this local key.</p>
        <a className="btn" href="/connect">{local.configured ? 'Manage local OpenAI connection' : 'Connect OpenAI on this laptop'}</a>
      </details> : <details className="ai-key-details">
        <summary>{savedKey ? 'API key saved · manage key' : 'Set up your API key'}</summary>
        <p className="muted">Suggestions are generated with Anthropic and may contain mistakes. This optional connection uses your API credits. The key is saved in this browser. Remove it after using a shared device.</p>
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
      </details>}

      <p id="ai-privacy" className="suggestion-privacy">When you tap Generate, your birth year and any hometown, spouse and job answers go to {local ? 'OpenAI through this laptop’s local server' : 'Anthropic'} to generate drafts. Those answers can identify someone. Your profile name, coordinates and evening logs are not sent.</p>
      <button className="btn primary" onClick={generate} disabled={!canGenerate || busy || drafts.length > 0}
        aria-describedby="ai-privacy">{busy ? 'Writing prompts…' : 'Generate prompts'}</button>
      {!canGenerate && <p className="muted">{!connectionChecked ? 'Checking the optional connection…' : local ? 'Connect a key above to generate prompts.' : 'Add a key above to generate prompts.'}</p>}
      {message && <p className="status" role="status">{message}</p>}
      {error && <p className="status" role="alert">{error}</p>}

      {drafts.length > 0 && <div className="ai-review">
        <h3>Review before sharing</h3>
        <p className="muted">These generated drafts can get things wrong. Skip anything inaccurate, uncomfortable or likely to feel like a memory test. Only your selections enter the routine.</p>
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
        <h3>Your selected starters ({approved.length})</h3>
        <p className="muted">Reviewed by you, saved on this device and available offline.</p>
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
