import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Subject } from '../../types';
import { getBackendUrl } from '../../lib/config';
import MarkdownEditor from '../common/MarkdownEditor';
import buttons from '../../styles/Buttons.module.css';
import modalStyles from '../../styles/Modal.module.css';

interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  universityId: string;
  facultyId: string;
  onUpdated: (subject: Subject) => void;
}

const EditSubjectModal: React.FC<EditSubjectModalProps> = ({ isOpen, onClose, subject, universityId, facultyId, onUpdated }) => {
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code);
  const [isActive, setIsActive] = useState<boolean>(subject.is_active);
  const [desc, setDesc] = useState<string>(subject.description || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(subject.name);
    setCode(subject.code);
  setIsActive(subject.is_active);
  setDesc(subject.description || '');
  }, [subject]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subject.id}` ,{
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          description: desc || null,
          is_active: isActive
        })
      });
      if (resp.ok) {
        const updated = await resp.json();
  onUpdated(updated);
        onClose();
      } else if (resp.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
      } else {
        alert('Failed to update subject');
      }
    } catch (e) {
      console.error(e);
      alert('Error while updating subject');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const form = new FormData();
      form.append('file', file);
      const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subject.id}/logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });
      if (resp.ok) {
        const updated = await resp.json();
        onUpdated(updated);
      } else if (resp.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
      } else {
        alert('Failed to upload logo');
      }
    } catch (e) {
      console.error(e);
      alert('Error uploading logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!subject.logo_url) return;
    if (!confirm('Remove current logo?')) return;
    setDeletingLogo(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subject.id}/logo`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const updated = await resp.json();
        onUpdated(updated);
      } else if (resp.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
      } else {
        alert('Failed to delete logo');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting logo');
    } finally {
      setDeletingLogo(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, width: 'min(680px, 92vw)', padding: '1.25rem 1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Edit Subject</h2>
          <button onClick={onClose} className={modalStyles.closeButton} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Subject name" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8 }} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="E.g. MATH101" style={{ padding: '0.6rem 0.75rem', border: '1px solid #ddd', borderRadius: 8, textTransform: 'uppercase' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span>Active</span>
          </label>
          <div>
            <h3 style={{ margin: '0.5rem 0', fontSize: '1.05rem' }}>Description</h3>
            <MarkdownEditor value={desc} onChange={setDesc} onSave={handleSave} isSaving={saving} placeholder="Add a detailed description (Markdown supported)" />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Logo</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {subject.logo_url ? (
              <Image src={`${getBackendUrl()}${subject.logo_url}`} alt="Subject logo" width={64} height={64} style={{ objectFit: 'contain', borderRadius: 8, background: '#f8f9fa', border: '1px solid #eee' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px dashed #ccc', display: 'grid', placeItems: 'center', color: '#888' }}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${buttons.btn} ${buttons.btnPrimary}`}>{uploading ? 'Uploading…' : (subject.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {subject.logo_url && (
              <button onClick={handleDeleteLogo} disabled={deletingLogo} className={`${buttons.btn} ${buttons.btnDanger}`}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditSubjectModal;
