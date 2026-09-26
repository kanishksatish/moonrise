const TABS = [
  { id: 'today', label: 'Today', icon: '☾' },
  { id: 'log', label: 'Log', icon: '✎' },
  { id: 'report', label: 'Report', icon: '▤' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function NavBar({ current, onChange }) {
  return (
    <nav className="navbar no-print">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={t.id === current ? 'nav-btn active' : 'nav-btn'}
          onClick={() => onChange(t.id)}
          aria-current={t.id === current ? 'page' : undefined}
        >
          <span className="nav-icon" aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
