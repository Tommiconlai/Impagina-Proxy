import { useState, useEffect } from 'react';
import { fetchPrints } from '../utils/scryfall';
import { IconX } from './icons';

// Box "cambia art": clic su una carta -> tutte le stampe Scryfall -> sostituisci.
export default function ArtPickerModal({ card, onClose, onPick }) {
    // ponytail: nome dedotto dal filename; DFC / caratteri speciali -> niente stampe.
    const name = card.file.name.replace(/\.[a-z0-9]+$/i, '');
    const [prints, setPrints] = useState(null); // null = caricamento, [] = nessuna
    const [error, setError] = useState(null);
    const [picking, setPicking] = useState(false);

    useEffect(() => {
        let alive = true;
        fetchPrints(name)
            .then((p) => { if (alive) setPrints(p); })
            .catch((e) => { if (alive) setError(e.message || 'Errore Scryfall.'); });
        return () => { alive = false; };
    }, [name]);

    const pick = async (p) => {
        setPicking(true);
        try { await onPick(p.png, name); }
        catch (e) { setError(e.message || 'Download fallito.'); setPicking(false); }
    };

    return (
        <div className="modal-overlay" onClick={picking ? undefined : onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Cambia art: ${name}`}>
                <div className="modal-header">
                    <h2>Cambia art — {name}</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Chiudi" disabled={picking}>
                        <IconX size={18} />
                    </button>
                </div>

                {error && <div className="info-box info-box-error"><span>{error}</span></div>}
                {prints === null && !error && (
                    <div className="import-status"><span className="import-spinner" /> Cerco stampe…</div>
                )}
                {prints && prints.length === 0 && (
                    <p className="modal-hint">Nessuna stampa trovata per “{name}”.</p>
                )}
                {prints && prints.length > 0 && (
                    <div className="art-grid">
                        {prints.map((p) => (
                            <button key={p.id} className="art-cell" onClick={() => pick(p)} disabled={picking} title={`${p.setName} (${p.set})`}>
                                <img src={p.thumb} alt={p.setName} loading="lazy" />
                                <span>{p.set}</span>
                            </button>
                        ))}
                    </div>
                )}
                {picking && <div className="import-status"><span className="import-spinner" /> Scarico…</div>}
            </div>
        </div>
    );
}
