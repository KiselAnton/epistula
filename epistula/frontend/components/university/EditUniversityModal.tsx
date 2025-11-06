import React, { useRef, useState } from 'react';
import SafeImage from '../common/SafeImage';
import WysiwygMarkdownEditor from '../common/WysiwygMarkdownEditor';
import { getBackendUrl } from '../../lib/config';
import { getCurrentUserRole } from '../../utils/auth';
import buttons from '../../styles/Buttons.module.css';
import styles from './EditUniversityModal.module.css';

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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit University</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="University name" className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="E.g. RSRCH" className={styles.inputUppercase} />
          </label>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <WysiwygMarkdownEditor value={desc} onChange={setDesc} onSave={saveFields} isSaving={saving} placeholder="Describe this university..." userRole={getCurrentUserRole()} />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Logo</h3>
          <div className={styles.logoContainer}>
            {university.logo_url ? (
              <SafeImage
                src={`${getBackendUrl()}${university.logo_url}`}
                alt="University logo"
                width={72}
                height={72}
                className={styles.logoImage}
              />
            ) : (
              <div className={styles.logoPlaceholder}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} className={styles.hiddenInput} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${buttons.btn} ${buttons.btnPrimary}`}>{uploading ? 'Uploading…' : (university.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {university.logo_url && (
              <button onClick={deleteLogo} disabled={deletingLogo} className={`${buttons.btn} ${buttons.btnDanger}`}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={saveFields} disabled={saving} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditUniversityModal;
