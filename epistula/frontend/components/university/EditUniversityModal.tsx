import React, { useRef, useState } from 'react';
import Image from 'next/image';
import SafeImage from '../common/SafeImage';
import MarkdownEditor from '../common/MarkdownEditor';
import { getBackendUrl } from '../../lib/config';
import buttons from '../../styles/Buttons.module.css';

export interface University {
  id: number;
  name: string;
  code: string;
  schema_name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  is_active: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  university: University;
  onUpdated: (u: University) => void;
}

const EditUniversityModal: React.FC<Props> = ({ isOpen, onClose, university, onUpdated }) => {
  const [name, setName] = useState(university.name);
  const [code, setCode] = useState(university.code);
  const [desc, setDesc] = useState(university.description || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const saveFields = async () => {
    setSaving(true);
    try {
      const trimmedName = (name || '').trim();
      const trimmedCode = (code || '').trim();
      if (!trimmedName || !trimmedCode) {
        alert('Name and Code cannot be empty');
        return;
      }
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${getBackendUrl()}/api/v1/universities/${university.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, code: trimmedCode.toUpperCase(), description: desc || null })
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      if (!res.ok) { const err = await res.json().catch(() => ({} as any)); alert(err?.detail || 'Failed to save'); return; }
      const updated: University = await res.json();
      onUpdated(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('token'); if (!token) return;
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${getBackendUrl()}/api/v1/universities/${university.id}/logo`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
      if (res.ok) { const updated: University = await res.json(); onUpdated(updated); }
      else if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      else { alert('Failed to upload logo'); }
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteLogo = async () => {
    if (!university.logo_url) return;
    if (!confirm('Remove current logo?')) return;
    setDeletingLogo(true);
    try {
      const token = localStorage.getItem('token'); if (!token) return;
      const res = await fetch(`${getBackendUrl()}/api/v1/universities/${university.id}/logo`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const updated: University = await res.json(); onUpdated(updated); }
      else if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      else { alert('Failed to delete logo'); }
    } finally { setDeletingLogo(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, width: 'min(880px, 96vw)', padding: '1.25rem 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit University</h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="University name" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="E.g. RSRCH" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8, textTransform: 'uppercase' }} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Description</h3>
          <MarkdownEditor value={desc} onChange={setDesc} onSave={saveFields} isSaving={saving} placeholder="Describe this university..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Logo</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {university.logo_url ? (
              <SafeImage
                src={`${getBackendUrl()}${university.logo_url}`}
                alt="University logo"
                width={72}
                height={72}
                style={{ borderRadius: 8, background: '#f8f9fa', border: '1px solid #eee' }}
              />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 8, border: '1px dashed #ccc', display: 'grid', placeItems: 'center', color: '#888' }}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${buttons.btn} ${buttons.btnPrimary}`}>{uploading ? 'Uploading…' : (university.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {university.logo_url && (
              <button onClick={deleteLogo} disabled={deletingLogo} className={`${buttons.btn} ${buttons.btnDanger}`}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={saveFields} disabled={saving} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditUniversityModal;
