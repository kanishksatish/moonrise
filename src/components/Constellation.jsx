import { eveningDate, localDateString } from '../engine/index.js'
const HEIGHTS = [45, 22, 38, 14, 32, 18, 43]
export default function Constellation({ logs, now }) {
  const end = eveningDate(now)
  const nights = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end)
    date.setDate(date.getDate() - 6 + index)
    const key = localDateString(date)
    return { key, label: date.toLocaleDateString(undefined, { weekday: 'short' }), log: logs.find(log => log.date === key) }
  })
  const count = nights.filter(night => night.log).length
  return (
    <section className="constellation" aria-label="Your seven evening constellation">
      <p className="eyebrow">The little things add up</p>
      <div className="section-heading"><h2>Your little<br/><em>constellation.</em></h2><span className="constellation-count"><span aria-hidden="true">{count} / 7</span><span className="sr-only">{count} of 7 logged</span></span></div>
      <p>One star for each evening you record. Every kind of evening counts.</p>
      {nights.some(night => night.log?.demo) && <p className="constellation-demo">Includes demo evenings.</p>}
      <svg viewBox="0 0 600 74" aria-hidden="true">
        <path d={HEIGHTS.map((y, i) => `${i ? 'L' : 'M'}${30 + i * 90} ${y}`).join(' ')} fill="none" stroke="currentColor" strokeOpacity=".22" strokeDasharray="3 7"/>
        {nights.map((night, i) => <g key={night.key} transform={`translate(${30 + i * 90} ${HEIGHTS[i]})`} className={night.log ? 'star-filled' : 'star-empty'}>
          {night.log && <circle r="13" fill="currentColor" opacity=".12"/>}
          <path d="M0 -7L2 -2L7 0L2 2L0 7L-2 2L-7 0L-2 -2Z" fill={night.log ? 'currentColor' : 'none'} stroke="currentColor"/>
        </g>)}
      </svg>
      <ol className="constellation-days">{nights.map(night => <li key={night.key}><span>{night.label}</span><span className="sr-only">{night.log ? ', evening logged' : ', no log'}</span></li>)}</ol>
    </section>
  )
}
