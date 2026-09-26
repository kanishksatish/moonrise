import Brand from './Brand.jsx'
const TABS = [
  { id: 'today', label: 'Today', path: 'M20 15.4A9 9 0 0 1 8.6 4 9 9 0 1 0 20 15.4Z' },
  { id: 'log', label: 'Log', path: 'm15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z' },
  { id: 'report', label: 'Report', path: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4' },
  { id: 'settings', label: 'Settings', path: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6' },
]
export default function NavBar({ current, onChange }) {
  return (
    <nav className="navbar no-print" aria-label="Main navigation">
      <div className="nav-brand"><Brand /><p>A gentler way<br/>through the evening.</p></div>
      <div className="nav-tabs">
      {TABS.map((t) => (
        <button key={t.id} className={t.id === current ? 'nav-btn active' : 'nav-btn'} onClick={() => onChange(t.id)} aria-current={t.id === current ? 'page' : undefined}>
          <svg className="nav-icon" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t.path}/></svg>
          {t.label}
        </button>
      ))}
      </div>
      <div className="nav-foot" aria-hidden="true"><span>☾</span><p>One evening<br/>at a time.</p><i/></div>
    </nav>
  )
}
