import { moonPhase, skyState } from '../engine/index.js'
import MoonIcon from './MoonIcon.jsx'

// The live sky behind Moonrise mode (AGENTS.md screen 3): a gradient that tracks the real sky,
// stars that appear as it darkens, warm lamp light that grows as the sky darkens, and a moon
// that slowly rises over the session. Purely decorative; nothing here needs to be read or pressed.
export const MOON_RISE_MINUTES = 60

// Fixed positions so stars don't jump between renders.
const STARS = Array.from({ length: 36 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53) % 55, size: 2 + (i % 3) }))

export default function SkyStage({ now, startedAt, lat, lon }) {
  const sky = skyState(now, lat, lon)
  const moon = moonPhase(now)
  const rise = Math.max(0, Math.min(1, (now.getTime() - startedAt) / (MOON_RISE_MINUTES * 60000)))
  const glow = 0.12 + 0.5 * sky.warmth
  return (
    <div className="sky-stage" aria-hidden="true" data-darkness={sky.darkness.toFixed(2)} data-rise={rise.toFixed(3)}
      style={{ background: `linear-gradient(to bottom, ${sky.gradient.top}, ${sky.gradient.bottom})` }}>
      <div className="sky-stage__stars" style={{ opacity: Math.max(0, sky.darkness - 0.3) }}>
        {STARS.map((s, i) => <span key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}/>)}
      </div>
      <div className="sky-stage__moon" style={{ '--rise': rise }}><MoonIcon phase={moon.phase} decorative/></div>
      <div className="sky-stage__glow" style={{ background: `radial-gradient(ellipse at 50% 120%, rgba(255, 170, 90, ${glow}) 0%, rgba(255, 170, 90, 0) 70%)` }}/>
    </div>
  )
}
