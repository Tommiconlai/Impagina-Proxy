import { useSyncExternalStore } from 'react';

// true sotto i 768px OPPURE su tablet in verticale (<=1024px portrait): in entrambi
// i casi si usa MobileLayout. Tablet in orizzontale e laptop restano desktop.
// ⚠️ Tenere allineato all'@media in index.css (override modali full-screen).
// useSyncExternalStore evita flicker e gestisce SSR (default false).
const QUERY = '(max-width: 768px), (max-width: 1024px) and (orientation: portrait)';
const mql = () => window.matchMedia(QUERY);
const subscribe = (cb) => { const m = mql(); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => mql().matches, () => false);
}
