import React from 'react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export default function ConfirmModal({ open, title = 'Please confirm', message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, busy = false }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.message}>
          {message}
        </div>
        <div className={styles.actions}>
          <button onClick={onCancel} disabled={busy} className={styles.cancelButton}> {cancelText} </button>
          <button onClick={onConfirm} disabled={busy} className={styles.confirmButton}> {confirmText} </button>
        </div>
      </div>
    </div>
  );
}
