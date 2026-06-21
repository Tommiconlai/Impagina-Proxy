import { useState } from 'react';
import BottomTabBar from './BottomTabBar';
import { Logo } from './icons';

export default function MobileLayout() {
  const [tab, setTab] = useState('cards');
  return (
    <div className="mobile">
      <header className="mobile-header">
        <Logo size={30} className="logo-mark" />
        <h1>Proxoteca</h1>
      </header>
      <main className="mobile-body" role="tabpanel">
        {tab === 'cards' && <div style={{ padding: 16 }}>Cards</div>}
        {tab === 'settings' && <div style={{ padding: 16 }}>Settings</div>}
        {tab === 'export' && <div style={{ padding: 16 }}>Export</div>}
      </main>
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
