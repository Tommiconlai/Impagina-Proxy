import { useState, useEffect } from 'react';
import { fetchPrints, downloadAsFile } from '../utils/scryfall';
import { searchMpcPrints, MPC_PRINTS_LIMIT } from '../utils/mpcfill';
import { IconX } from './icons';

// Box "cambia art": clic su una carta -> stampe della sorgente scelta -> sostituisci.
// `source` = 'scryfall' (stampe ufficiali) | 'mpc' (database MPCFill, art al vivo).
export default function ArtPickerModal({ card, source = 'scryfall', onClose, onPick }) {
    // ponytail: nome dedotto dal filename; DFC / caratteri speciali -> niente stampe.
    const name = card.file.name.replace(/\.[a-z0-9]+$/i, '');
    const isMpc = source === 'mpc';
    const [prints, setPrints] = useState(null); // null = caricamento, [] = nessuna
    const [error, setError] = useState(null);
    const [picking, setPicking] = useState(false);

    useEffect(() => {
        let alive = true;
        const search = isMpc ? searchMpcPrints : fetchPrints;
        search(name)
            .then((p) => { if (alive) setPrints(p); })
            .catch((e) => { if (alive) setError(e.message || 'Search error.'); });
        return () => { alive = false; };
    }, [name, isMpc]);

    const pick = async (p) => {
        setPicking(true);
        try {
            // lh3 (MPC) e le immagini Scryfall sono entrambe leggibili → File via fetch.
            const file = await downloadAsFile(p.png, name);
            await onPick(file, isMpc
                ? { bleedMode: 'full', set: null, collector: null } // art MPC già al vivo
                // come l'import Scryfall: full-art/borderless → mirror, altrimenti stretch
                : { bleedMode: (p.fullArt || p.borderless) ? 'mirror' : 'stretch', set: p.set, collector: p.collector });
        } catch (e) { setError(e.message || 'Download failed.'); setPicking(false); }
    };

    const label = isMpc ? 'MPCFill' : 'Scryfall';

    return (
        <div className="modal-overlay" onClick={picking ? undefined : onClose}>
            <div className="modal modal-art" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Change art (${label}): ${name}`}>
                <div className="modal-header">
                    <h2>Change art — {name} <span className="modal-source-tag">{label}</span></h2>
                    <button className="modal-close" onClick={onClose} aria-label="Close" disabled={picking}>
                        <IconX size={18} />
                    </button>
                </div>

                {error && <div className="info-box info-box-error"><span>{error}</span></div>}
                {prints === null && !error && (
                    <div className="import-status"><span className="import-spinner" /> Searching printings…</div>
                )}
                {prints && prints.length === 0 && (
                    <p className="modal-hint">No printings found for “{name}” on {label}.</p>
                )}
                {prints && prints.length > 0 && (
                    <>
                        {isMpc && prints.length >= MPC_PRINTS_LIMIT && (
                            <p className="modal-hint">Showing the first {MPC_PRINTS_LIMIT} results — refine by renaming the card if needed.</p>
                        )}
                        <div className="art-grid">
                            {prints.map((p) => (
                                <button key={p.id} className="art-cell" onClick={() => pick(p)} disabled={picking} title={`${p.setName} (${p.set})`}>
                                    <img src={p.thumb} alt={p.setName} loading="lazy" />
                                    <span>{p.set}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
                {picking && <div className="import-status"><span className="import-spinner" /> Downloading…</div>}
            </div>
        </div>
    );
}
