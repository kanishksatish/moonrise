const PHASE_EMOJI = {
  'New Moon': '🌑',
  'Waxing Crescent': '🌒',
  'First Quarter': '🌓',
  'Waxing Gibbous': '🌔',
  'Full Moon': '🌕',
  'Waning Gibbous': '🌖',
  'Last Quarter': '🌗',
  'Waning Crescent': '🌘',
}

export default function MoonIcon({ name }) {
  return (
    <span className="moon-icon" role="img" aria-label={name}>
      {PHASE_EMOJI[name] ?? '🌕'}
    </span>
  )
}
