import React, { useEffect, useRef, useState } from 'react';
import SafeImage from '../common/SafeImage';
import { Subject } from '../../types';
import { getBackendUrl } from '../../lib/config';
import WysiwygMarkdownEditor from '../common/WysiwygMarkdownEditor';
import { getCurrentUserRole } from '../../utils/auth';
import buttons from '../../styles/Buttons.module.css';
import modalStyles from '../../styles/Modal.module.css';
import styles from '../../styles/SharedModal.module.css';

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
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Subject</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        <div className={styles.formGridSingle}>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Subject name" className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            <span className={styles.fieldLabelText}>Code</span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="E.g. MATH101" className={styles.inputUppercase} />
          </label>
          <label className={styles.fieldLabel}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span>Active</span>
          </label>
          <div>
            <h3 className={styles.sectionTitle}>Description</h3>
            <WysiwygMarkdownEditor value={desc} onChange={setDesc} onSave={handleSave} isSaving={saving} placeholder="Add a detailed description (Markdown supported)" userRole={getCurrentUserRole()} />
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Logo</h3>
          <div className={styles.logoContainer}>
            {subject.logo_url ? (
              <SafeImage src={`${getBackendUrl()}${subject.logo_url}`} alt="Subject logo" width={64} height={64} className={styles.logoImage} />
            ) : (
              <div className={styles.logoPlaceholder}>No logo</div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }} className={styles.hiddenInput} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`${buttons.btn} ${buttons.btnPrimary}`}>{uploading ? 'Uploading…' : (subject.logo_url ? 'Change Logo' : 'Upload Logo')}</button>
            {subject.logo_url && (
              <button onClick={handleDeleteLogo} disabled={deletingLogo} className={`${buttons.btn} ${buttons.btnDanger}`}>{deletingLogo ? 'Removing…' : 'Remove'}</button>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditSubjectModal;
