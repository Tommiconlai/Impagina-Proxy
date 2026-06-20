import { useState } from 'react';
import { parseCardList, fetchScryfallImages } from '../utils/scryfall';
import { IconX } from './icons';

export default function ScryfallImportModal({ open, onClose, onImport }) {
    const [text, setText] = useState(() => localStorage.getItem('ip:cardlist') || ''); // sopravvive al reload
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState(null); // { imported, notFound }
    const [error, setError] = useState(null);

    if (!open) return null;

    const close = () => { if (!busy) onClose(); };

    const handleImport = async () => {
        const entries = parseCardList(text);
        if (!entries.length) { setError('Inserisci almeno una carta.'); return; }
        setError(null);
        setResult(null);
        setBusy(true);
        setProgress({ done: 0, total: 0 });
        try {
            const { files, notFound } = await fetchScryfallImages(
                entries,
                (done, total) => setProgress({ done, total }),
            );
            if (files.length) onImport(files);
            setResult({ imported: files.length, notFound });
        } catch (e) {
            setError(e.message || 'Errore durante l’import.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={close}>
            <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Importa da Scryfall">
                <div className="modal-header">
                    <h2>Importa da Scryfall</h2>
                    <button className="modal-close" onClick={close} aria-label="Chiudi" disabled={busy}>
                        <IconX size={18} />
                    </button>
                </div>

                <p className="modal-hint">
                    Una carta per riga, formato <code>1x Nome Carta</code>. Aggiungi <code>(SET) num</code> per
                    scegliere la stampa (es. <code>1x Sol Ring (C21) 263</code>). Le doppia-faccia importano fronte e retro.
                </p>

                <textarea
                    className="import-textarea"
                    value={text}
                    onChange={(e) => { setText(e.target.value); localStorage.setItem('ip:cardlist', e.target.value); if (result) setResult(null); }}
                    placeholder={'1x Sol Ring\n2x Brainstorm\n1x Fable of the Mirror-Breaker'}
                    rows={10}
                    disabled={busy}
                    spellCheck={false}
                />

                {error && (
                    <div className="info-box info-box-error"><span>{error}</span></div>
                )}

                {busy && (
                    <div className="import-status">
                        <span className="import-spinner" />
                        Scarico immagini{progress.total ? ` ${progress.done}/${progress.total}` : '…'}
                    </div>
                )}

                {result && (
                    <div className="import-result">
                        <div>✓ {result.imported} immagini importate</div>
                        {result.notFound.length > 0 && (
                            <div className="import-notfound">
                                ✗ {result.notFound.length} non trovate: {result.notFound.join(', ')}
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-actions">
                    {!result && (
                        <button className="btn-secondary" onClick={close} disabled={busy}>Chiudi</button>
                    )}
                    <button
                        className="btn-generate import-btn"
                        onClick={busy ? undefined : (result ? onClose : handleImport)}
                        disabled={busy || (!result && !text.trim())}
                    >
                        {busy ? <><span className="spinner" /> Import…</> : result ? 'Finito' : 'Importa'}
                    </button>
                </div>
            </div>
        </div>
    );
}
