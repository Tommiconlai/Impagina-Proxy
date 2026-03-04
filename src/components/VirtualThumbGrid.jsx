import { useState, useRef, useEffect, memo } from 'react';

const THUMB_W = 90;  // px
const THUMB_H = 128; // px (aspect 63/89)
const GAP = 8;       // px

/**
 * Singola card virtualizzata.
 * Usa IntersectionObserver: quando è fuori dalla viewport,
 * viene rimpiazzata da un placeholder vuoto per risparmiare memoria.
 */
const ThumbCard = memo(function ThumbCard({ item, onRemove }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => setVisible(entry.isIntersecting),
            { rootMargin: '200px 0px' } // pre-carica 200px prima di entrare in viewport
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className="thumb-item"
            style={{ width: THUMB_W, height: THUMB_H, flexShrink: 0 }}
        >
            {visible ? (
                <>
                    <img src={item.preview} alt="" />
                    <button
                        className="thumb-remove"
                        onClick={() => onRemove(item.id)}
                        title="Rimuovi immagine"
                    >✕</button>
                </>
            ) : null}
        </div>
    );
});

/**
 * Griglia di thumbnail con lazy rendering tramite IntersectionObserver.
 * Le card fuori dalla viewport non renderizzano img né button,
 * riducendo drasticamente il numero di nodi DOM attivi.
 */
export default function VirtualThumbGrid({ images, onRemove }) {
    return (
        <div className="thumb-grid-virtual">
            {images.map(item => (
                <ThumbCard key={item.id} item={item} onRemove={onRemove} />
            ))}
        </div>
    );
}
