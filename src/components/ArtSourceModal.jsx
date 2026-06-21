import { IconX, IconDownload, IconFile } from './icons';

// Passo intermedio del "cambia art": chiede da dove cercare l'arte
// (Scryfall = stampe ufficiali, MPCFill = database custom al vivo).
export default function ArtSourceModal({ name, onPick, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-source" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Choose art source">
                <div className="modal-header">
                    <h2>Change art — {name}</h2>
                    <button className="modal-close" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
                </div>
                <p className="modal-hint">Where do you want to search for art?</p>
                <div className="art-source-row">
                    <button className="art-source-btn" onClick={() => onPick('scryfall')}>
                        <IconDownload size={22} />
                        <strong>Scryfall</strong>
                        <span>Official printings</span>
                    </button>
                    <button className="art-source-btn" onClick={() => onPick('mpc')}>
                        <IconFile size={22} />
                        <strong>MPCFill</strong>
                        <span>Custom, print-ready</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
