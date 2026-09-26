// Development-only visual fixture. No AI requests; absent from the production build.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import AiPrompts from '../../src/components/AiPrompts.jsx'
import '../../src/index.css'
import '../../src/styles/app.css'
import '../../src/styles/visual.css'

function ReviewFixture() {
  const [state, update] = useState({ profile: { name: 'Fictional Rose', birthYear: 1942, anchors: { hometown: 'Dayton' } }, logs: [] })
  return <div className="app"><main className="screen">
    <h1>TEST · simulated AI reply</h1>
    <p>Fictional visual test only. Enter any dummy key. Generate returns three fixed samples without a network request. Approvals last only while this page is open.</p>
    <AiPrompts state={state} update={update} generatePrompts={async () => [
      'What flowers grew near your childhood home?',
      'Tell me about a favourite weekend breakfast.',
      'What sounds filled the streets of your hometown on a warm evening?',
    ]} />
  </main></div>
}
createRoot(document.getElementById('root')).render(<ReviewFixture />)
