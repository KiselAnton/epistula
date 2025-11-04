import React from 'react';

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
    <div role="dialog" aria-modal="true" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'grid', placeItems:'center', zIndex:1000 }} onClick={onCancel}>
      <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.2)', width:'min(520px, 94vw)', padding:'1.25rem 1.25rem 1rem', border:'1px solid #eee' }} onClick={e => e.stopPropagation()}>
        {title && <h2 style={{ margin:'0 0 0.5rem 0', fontSize:'1.25rem' }}>{title}</h2>}
        <div style={{ marginBottom:'1rem', color:'#333', lineHeight:1.45 }}>
          {message}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem' }}>
          <button onClick={onCancel} disabled={busy} style={{ padding:'0.5rem 0.9rem', borderRadius:6, border:'1px solid #ccc', background:'#f8f9fa', cursor:'pointer' }}> {cancelText} </button>
          <button onClick={onConfirm} disabled={busy} style={{ padding:'0.5rem 0.9rem', borderRadius:6, border:'none', background:'#dc3545', color:'#fff', cursor:'pointer' }}> {confirmText} </button>
        </div>
      </div>
    </div>
  );
}
