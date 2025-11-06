import React, { useRef, useState } from 'react';
import SafeImage from '../common/SafeImage';
import { Faculty } from '../../types';
import WysiwygMarkdownEditor from '../common/WysiwygMarkdownEditor';
import { getBackendUrl } from '../../lib/config';
import { getCurrentUserRole } from '../../utils/auth';
import styles from './EditFacultyModal.module.css';

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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Faculty</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Faculty name" className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Short Name</span>
            <input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="E.g. IMPL" className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code" className={styles.inputUppercase} />
          </label>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Description</h3>
          <WysiwygMarkdownEditor value={desc} onChange={setDesc} onSave={saveFields} isSaving={saving} placeholder="Describe this faculty..." userRole={getCurrentUserRole()} />
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Logo</h3>
          <div className={styles.logoContainer}>
            {faculty.logo_url ? (
              <SafeImage src={`${getBackendUrl()}${faculty.logo_url}`} alt="Faculty logo" width={72} height={72} className={styles.logoImage} />
            ) : (
              <div className={styles.logoPlaceholder}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} className={styles.hiddenInput} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={styles.buttonPrimary}>{uploading ? 'Uploading…' : (faculty.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {faculty.logo_url && (
              <button onClick={deleteLogo} disabled={deletingLogo} className={styles.buttonDanger}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={styles.buttonSecondary}>Cancel</button>
          <button onClick={saveFields} disabled={saving} className={styles.buttonSuccess}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditFacultyModal;
