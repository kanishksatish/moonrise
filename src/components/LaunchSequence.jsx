import { useCallback, useEffect, useId, useRef } from 'react'
import MoonIcon from './MoonIcon.jsx'
import { flightFrame, FLIGHT_MS } from './launchFlight.js'
import '../styles/launch-sequence.css'

const LAUNCH_MS = 2400
const STARS = [[7,18,2],[13,57,1],[20,32,1],[29,12,2],[35,71,1],[40,29,1],[47,8,1],[52,57,2],[59,20,1],[63,83,1],[69,46,1],[76,69,2],[81,11,1],[86,39,2],[93,76,1],[96,21,1]]

// Mount only after the caregiver starts a routine. Ordinary parent updates do
// not restart the flight, and completing or skipping it is always idempotent.
export default function LaunchSequence({ onComplete, phase = 0.5 }) {
  const callback = useRef(onComplete)
  const completed = useRef(false)
  const timer = useRef(null)
  const skipButton = useRef(null)
  const flightSvg = useRef(null)
  const rocket = useRef(null)
  const trail = useRef(null)
  const animationFrame = useRef(null)
  const id = useId().replaceAll(':', '')
  useEffect(() => { callback.current = onComplete }, [onComplete])

  const finish = useCallback(() => {
    if (completed.current) return
    completed.current = true
    clearTimeout(timer.current)
    window.cancelAnimationFrame?.(animationFrame.current)
    callback.current()
  }, [])

  useEffect(() => {
    if (completed.current) return
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const preferenceChanged = (event) => { if (event.matches) finish() }
    if (motion?.matches) {
      finish()
      return
    }
    const svg = flightSvg.current
    let width = 1000, height = 600
    const started = performance.now()
    let elapsed = 0
    const paint = () => {
      const frame = flightFrame(elapsed, width, height)
      rocket.current?.setAttribute('transform', frame.transform)
      rocket.current?.setAttribute('opacity', frame.rocketOpacity)
      trail.current?.setAttribute('d', frame.trail)
      trail.current?.setAttribute('opacity', frame.trailOpacity)
    }
    const resize = () => {
      const bounds = svg.getBoundingClientRect()
      if (bounds.width && bounds.height) { width = bounds.width; height = bounds.height }
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      paint()
    }
    const tick = now => {
      if (completed.current) return
      elapsed = Math.max(0, now - started)
      paint()
      if (elapsed < FLIGHT_MS) animationFrame.current = window.requestAnimationFrame(tick)
    }
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(svg)
    if (!observer) window.addEventListener('resize', resize)
    if (window.requestAnimationFrame) animationFrame.current = window.requestAnimationFrame(tick)
    skipButton.current?.focus({ preventScroll: true })
    timer.current = setTimeout(finish, LAUNCH_MS)
    if (motion?.addEventListener) motion.addEventListener('change', preferenceChanged)
    else motion?.addListener?.(preferenceChanged)
    return () => {
      clearTimeout(timer.current)
      window.cancelAnimationFrame?.(animationFrame.current)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', resize)
      if (motion?.removeEventListener) motion.removeEventListener('change', preferenceChanged)
      else motion?.removeListener?.(preferenceChanged)
    }
  }, [finish])

  function handleKeyDown(event) {
    if (event.key === 'Escape') finish()
    if (event.key === 'Tab') {
      event.preventDefault()
      skipButton.current?.focus()
    }
  }

  return (
    <div className="launch-sequence" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onKeyDown={handleKeyDown}>
      <div className="launch-star-field" aria-hidden="true">
        {STARS.map(([x, y, size]) => <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }} />)}
      </div>
      <button ref={skipButton} type="button" className="launch-skip" onClick={finish}>Skip launch <span aria-hidden="true">↗</span></button>
      <div className="launch-art" aria-hidden="true">
        <div className="launch-lunar-orbit" />
        <div className="launch-destination"><MoonIcon phase={phase} decorative /></div>
        <svg ref={flightSvg} className="launch-flight-path" viewBox="0 0 1000 600" fill="none">
          <defs>
            <linearGradient id={`${id}-trail`} x1="0" y1="1" x2="1" y2="0">
              <stop stopColor="#eac39c" stopOpacity="0"/><stop offset=".6" stopColor="#eac39c" stopOpacity=".35"/><stop offset="1" stopColor="#f5e6ce" stopOpacity=".65"/>
            </linearGradient>
            <linearGradient id={`${id}-hull`} x1="12" y1="40" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stopColor="#c6b59c"/><stop offset=".35" stopColor="#fff9ed"/><stop offset="1" stopColor="#d4c4ad"/></linearGradient>
            <linearGradient id={`${id}-flame`} x1="26" y1="73" x2="26" y2="110" gradientUnits="userSpaceOnUse"><stop stopColor="#fff2d5"/><stop offset=".4" stopColor="#eac39c" stopOpacity=".6"/><stop offset="1" stopColor="#eac39c" stopOpacity="0"/></linearGradient>
          </defs>
          <path ref={trail} className="launch-trail" opacity="0" stroke={`url(#${id}-trail)`} strokeWidth="1.5" strokeLinecap="round" />
          <g ref={rocket} className="launch-rocket" opacity="0">
            <path d="M19 72C18 84 22 100 26 110c4-10 8-26 7-38H19Z" fill={`url(#${id}-flame)`}/>
            <path d="m15 43-9 15-2 17 12-6m21-26 9 15 2 17-12-6" fill="#b88a64" stroke="#eac39c" strokeWidth=".8"/>
            <path d="M26 3C16 15 12 31 13 48l3 22h20l3-22C40 31 36 15 26 3Z" fill={`url(#${id}-hull)`} stroke="#f3e4d1" strokeWidth=".8"/>
            <path d="M18 17c2-6 5-11 8-14 3 3 6 8 8 14Z" fill="#b88a64"/>
            <circle cx="26" cy="37" r="7" fill="#161d22" stroke="#b88a64" strokeWidth="2"/>
            <path d="M23 35a4 4 0 0 1 5-2" stroke="#d5e3e2" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M16 63h20M20 70v5h12v-5" stroke="#b88a64" strokeWidth="2"/>
            <path d="M26 51v17" stroke="#b88a64" strokeWidth="1"/>
          </g>
        </svg>
        <div className="launch-horizon" />
      </div>
      <div className="launch-copy"><h1 id={`${id}-title`}>A little space<br/><em>for calm.</em></h1></div>
      <div className="launch-progress" aria-hidden="true"><span /></div>
    </div>
  )
}
