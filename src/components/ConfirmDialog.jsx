import { IconAlert } from './icons';

/**
 * Conferma generica per azioni distruttive (es. "Elimina tutte"). Riusa lo stile
 * `.modal`; il modificatore `.modal-confirm` lo tiene piccolo/centrato anche su
 * mobile (dove i modali normali sono full-screen).
 */
export default function ConfirmDialog({ open, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="confirm-body">
          <IconAlert size={20} />
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
