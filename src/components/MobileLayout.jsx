import { useState } from 'react';
import BottomTabBar from './BottomTabBar';
import { Logo, IconFile, IconDownload, IconTrash } from './icons';
import PageSettings from './PageSettings';

export default function MobileLayout({ settingsProps, actions }) {
  const [tab, setTab] = useState('cards');
  return (
    <div className="mobile">
      <header className="mobile-header">
        <Logo size={30} className="logo-mark" />
        <h1>Proxoteca</h1>
      </header>
      <main className="mobile-body" role="tabpanel">
        {tab === 'cards' && <div style={{ padding: 16 }}>Cards</div>}
        {tab === 'settings' && (
          <div className="mobile-settings"><PageSettings {...settingsProps} /></div>
        )}
        {tab === 'export' && (
          <div className="mobile-export">
            <div className="export-summary">
              <strong>{actions.count}</strong> card{actions.count !== 1 ? 's' : ''}
              {actions.missing > 0 && <span> · {actions.missing} to fill the page</span>}
            </div>
            {actions.lowResCount > 0 && (
              <div className="lowres-warn"><span className="lowres-mark" aria-hidden="true">!</span>
                <span>{actions.lowResCount} card{actions.lowResCount > 1 ? 's' : ''} too low-res for {actions.dpi} DPI — lower the DPI or use higher-res art.</span></div>
            )}
            <button className="btn-generate" onClick={actions.onGenerate} disabled={actions.count === 0 || actions.loading}>
              {actions.loading ? <><span className="spinner" /> Generating…</> : <><IconFile size={18} /> Generate PDF</>}
            </button>
            <div className="export-row">
              <button className="btn-secondary btn-save" onClick={actions.onSave} disabled={actions.count === 0}><IconDownload size={15} /> Save list</button>
              <button className="btn-secondary" onClick={actions.onClear} disabled={actions.count === 0}><IconTrash size={15} /> Delete all</button>
            </div>
            {actions.notice && <div className="info-box"><span>{actions.notice}</span></div>}
            {actions.error && <div className="info-box info-box-error"><span>{actions.error}</span></div>}
          </div>
        )}
      </main>
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
