import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Faculty } from '../../types';
import MarkdownEditor from '../subject/MarkdownEditor';
import { getBackendUrl } from '../../lib/config';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  universityId: string;
  faculty: Faculty;
  onUpdated: (f: Faculty) => void;
}

const EditFacultyModal: React.FC<Props> = ({ isOpen, onClose, universityId, faculty, onUpdated }) => {
  const [name, setName] = useState(faculty.name);
  const [shortName, setShortName] = useState(faculty.short_name);
  const [code, setCode] = useState(faculty.code);
  const [desc, setDesc] = useState(faculty.description || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const saveFields = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token'); if (!token) return;
      const res = await fetch(`${getBackendUrl()}/api/v1/faculties/${universityId}/${faculty.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, short_name: shortName, code, description: desc || null })
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      if (!res.ok) { const err = await res.json().catch(() => ({} as any)); alert(err?.detail || 'Failed to save'); return; }
      const updated: Faculty = await res.json();
      onUpdated(updated);
      onClose();
    } finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('token'); if (!token) return;
      const form = new FormData(); form.append('file', file);
      const res = await fetch(`${getBackendUrl()}/api/v1/faculties/${universityId}/${faculty.id}/logo`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
      if (res.ok) { const updated: Faculty = await res.json(); onUpdated(updated); }
      else if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      else { alert('Failed to upload logo'); }
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteLogo = async () => {
    if (!faculty.logo_url) return;
    if (!confirm('Remove current logo?')) return;
    setDeletingLogo(true);
    try {
      const token = localStorage.getItem('token'); if (!token) return;
      const res = await fetch(`${getBackendUrl()}/api/v1/faculties/${universityId}/${faculty.id}/logo`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const updated: Faculty = await res.json(); onUpdated(updated); }
      else if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/'; return; }
      else { alert('Failed to delete logo'); }
    } finally { setDeletingLogo(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, width: 'min(880px, 96vw)', padding: '1.25rem 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit Faculty</h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Faculty name" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Short Name</span>
            <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="E.g. IMPL" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8, textTransform: 'uppercase' }} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Description</h3>
          <MarkdownEditor value={desc} onChange={setDesc} onSave={saveFields} isSaving={saving} placeholder="Describe this faculty..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>Logo</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {faculty.logo_url ? (
              <Image src={`${getBackendUrl()}${faculty.logo_url}`} alt="Faculty logo" width={72} height={72} style={{ objectFit: 'contain', borderRadius: 8, background: '#f8f9fa', border: '1px solid #eee' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 8, border: '1px dashed #ccc', display: 'grid', placeItems: 'center', color: '#888' }}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding: '0.5rem 0.9rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{uploading ? 'Uploading…' : (faculty.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {faculty.logo_url && (
              <button onClick={deleteLogo} disabled={deletingLogo} style={{ padding: '0.5rem 0.9rem', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '0.6rem 1rem', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          <button onClick={saveFields} disabled={saving} style={{ padding: '0.6rem 1rem', background: '#28a745', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditFacultyModal;
