// Development-only browser fixture, not imported by the production entry point.
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/App.jsx'
import '../../src/index.css'
import '../../src/styles/app.css'

const RealDate = Date
const fixed = new RealDate('2026-09-27T05:30:00.000Z').getTime()
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixed])) }
  static now() { return fixed }
}
const realFetch = globalThis.fetch
globalThis.fetch = (url, options) => {
  if (String(url).startsWith('https://api.open-meteo.com/')) {
    const day = new URL(url).searchParams.get('start_date')
    const sunset = new RealDate(`${day}T19:15:00-05:00`).getTime() / 1000
    return Promise.resolve(new Response(JSON.stringify({ daily: { sunset: [sunset] }, hourly: { time: [], cloud_cover: [] } }),
      { headers: { 'Content-Type': 'application/json' } }))
  }
  return realFetch(url, options)
}
localStorage.setItem('moonrise:v1', JSON.stringify({
  profile: { name: 'Midnight Test', birthYear: 1942, city: 'Dallas', lat: 32.78, lon: -96.8, anchors: {} },
  logs: [], tonight: { date: '2026-09-26', songIds: ['earth-angel-1954'] },
}))
document.getElementById('inspect').onclick = () => {
  document.getElementById('saved').textContent = JSON.stringify(JSON.parse(localStorage.getItem('moonrise:v1')).logs, null, 2)
}
createRoot(document.getElementById('root')).render(<App />)
