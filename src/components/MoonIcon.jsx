import { useId } from 'react'
import lunarSurface from '../assets/lunar-surface.webp'

// Inline lunar art stays crisp offline and never depends on an emoji font.
export default function MoonIcon({ name = 'Moon', phase = 0.5, decorative = false }) {
  const id = useId().replaceAll(':', '')
  const waxing = phase <= 0.5
  const curve = Math.cos(phase * Math.PI * 2)
  const radius = Math.max(0.01, Math.abs(curve) * 48)
  const lit = `M50 2 A48 48 0 0 1 50 98 A${radius} 48 0 0 ${curve >= 0 ? 0 : 1} 50 2Z`
  return (
    <svg className="moon-icon" viewBox="0 0 100 100" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : name}>
      <defs>
        <radialGradient id={`${id}-light`} cx="35%" cy="28%" r="80%">
          <stop stopColor="#fffbed"/><stop offset=".55" stopColor="#e4ddc8"/><stop offset="1" stopColor="#aaa38f"/>
        </radialGradient>
        <clipPath id={`${id}-lit`}><path d={lit} transform={waxing ? undefined : 'translate(100 0) scale(-1 1)'}/></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#232a3e" stroke="#d5d1ba" strokeOpacity=".22" strokeWidth=".5"/>
      <g clipPath={`url(#${id}-lit)`}>
        <circle cx="50" cy="50" r="48" fill={`url(#${id}-light)`}/>
        <g fill="#787563" opacity=".18">
          <ellipse cx="33" cy="32" rx="15" ry="12" transform="rotate(-25 33 32)"/>
          <ellipse cx="48" cy="49" rx="13" ry="20" transform="rotate(-30 48 49)"/>
          <ellipse cx="70" cy="33" rx="14" ry="10"/>
          <ellipse cx="67" cy="64" rx="17" ry="11" transform="rotate(25 67 64)"/>
          <ellipse cx="27" cy="59" rx="9" ry="13"/>
        </g>
        <g fill="none" stroke="#797362" strokeOpacity=".22" strokeWidth=".6">
          {[[28,27,6],[66,25,8],[59,69,7],[30,70,4],[79,52,5],[50,39,3],[45,83,3],[17,48,4]].map(([x,y,r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r}/>)}
        </g>
        <circle cx="37" cy="75" r="3" fill="#fff8e2" opacity=".6"/>
        <image href={lunarSurface} x="-2" y="-2" width="104" height="104"/>
      </g>
    </svg>
  )
}
