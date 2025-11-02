/**
 * Reusable confirmation dialog component
 */
import React from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  warning?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  warning = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div>
        <p>{message}</p>
        {children}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '1.5rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1.5rem',
              background: warning ? '#dc3545' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
