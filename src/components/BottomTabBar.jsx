import { IconLayout, IconFile } from './icons';

const TABS = [
  { key: 'cards', label: 'Cards', icon: 'cards' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'export', label: 'Export', icon: 'export' },
];

// ponytail: riusa icone esistenti dove possibile; le mancanti sono SVG inline minimi.
function TabIcon({ name }) {
  if (name === 'cards') return <IconLayout size={20} />;
  if (name === 'export') return <IconFile size={20} />;
  return ( // settings (sliders)
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2" fill="var(--bg-base)" /><circle cx="15" cy="16" r="2" fill="var(--bg-base)" />
    </svg>
  );
}

export default function BottomTabBar({ active, onChange }) {
  return (
    <nav className="tabbar" role="tablist" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          id={`tab-${t.key}`}
          role="tab"
          aria-selected={active === t.key}
          aria-controls={`panel-${t.key}`}
          className={`tabbar-btn${active === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <TabIcon name={t.icon} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
