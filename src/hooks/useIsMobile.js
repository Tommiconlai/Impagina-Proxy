import { useSyncExternalStore } from 'react';

// true sotto i 768px. useSyncExternalStore evita flicker e gestisce SSR (default false).
const QUERY = '(max-width: 768px)';
const mql = () => window.matchMedia(QUERY);
const subscribe = (cb) => { const m = mql(); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => mql().matches, () => false);
}
