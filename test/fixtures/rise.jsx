// Development-only UI fixture; it is not part of the production build.
import React from 'react'
import { createRoot } from 'react-dom/client'
import Moonrise from '../../src/screens/Moonrise.jsx'
import '../../src/index.css'
import '../../src/styles/app.css'
import '../../src/styles/visual.css'
const RealDate = Date
let fixed = new RealDate('2026-09-26T23:20:00Z').getTime()
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fixed])) }
  static now() { return fixed }
}
document.getElementById('advance').onclick = () => {
  fixed += 45 * 60000
  document.getElementById('clock').textContent = new RealDate(fixed).toLocaleTimeString()
  window.dispatchEvent(new Event('focus'))
}
createRoot(document.getElementById('root')).render(<Moonrise state={{profile:{ name:'Test', birthYear:1942, lat:32.78, lon:-96.8, anchors:{} },logs:[]}} onPlayed={()=>{}} onExit={()=>{}}/>)
