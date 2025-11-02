import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import { importEntities } from '../../utils/dataTransfer.api';
import { normalizeLower, normalizeUpper, isDuplicateBy } from '../../utils/duplicates';

export interface SubjectLite {
  id?: number;
  name: string;
  code: string;
  description?: string | null;
  faculty_id?: number;
  is_active?: boolean;
}

interface ImportSubjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  facultyId: string | number;
  existingSubjects: SubjectLite[];
  onImported: () => void;
}

const ImportSubjectWizard: React.FC<ImportSubjectWizardProps> = ({ isOpen, onClose, universityId, facultyId, existingSubjects, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<SubjectLite[]>([]); // loaded subjects (>=1)
  const [form, setForm] = useState<SubjectLite>({ name: '', code: '', description: '', is_active: true });
  const [strategy, setStrategy] = useState<'merge' | 'replace' | 'skip_existing'>('merge');

  const duplicateName = useMemo(() => {
    const name = (form.name || '').trim().toLowerCase();
    return !!existingSubjects.find(s => (s.name || '').trim().toLowerCase() === name);
  }, [form.name, existingSubjects]);

  const duplicateCode = useMemo(() => {
    const code = (form.code || '').trim().toUpperCase();
    return !!existingSubjects.find(s => (s.code || '').trim().toUpperCase() === code);
  }, [form.code, existingSubjects]);

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Accept exportEntities format
      if (json && json.entity_type === 'subjects' && Array.isArray(json.data) && json.data.length > 0) {
        setRawJson(json);
        const loaded = json.data.map((s: any) => ({
          name: s.name || '',
          code: (s.code || '').toUpperCase(),
          description: s.description ?? '',
          is_active: s.is_active !== false,
        } as SubjectLite));
        setItems(loaded);
        if (loaded.length === 1) {
          setForm(loaded[0]);
        }
        setStep(2);
        return;
      }

      // Single subject object fallback
      if (json && (json.name || json.code)) {
        setRawJson({ entity_type: 'subjects', data: [json] });
        const single: SubjectLite = {
          name: json.name || '',
          code: (json.code || '').toUpperCase(),
          description: json.description ?? '',
          is_active: json.is_active !== false,
        };
        setItems([single]);
        setForm(single);
        setStep(2);
        return;
      }

      throw new Error('Invalid file: not a recognized subject export');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const internalDupName = useMemo(() => {
    if (items.length <= 1) return false;
    const names = items.map((s) => normalizeLower(s.name));
    return new Set(names).size !== names.length;
  }, [items]);

  const internalDupCode = useMemo(() => {
    if (items.length <= 1) return false;
    const codes = items.map((s) => normalizeUpper(s.code));
    return new Set(codes).size !== codes.length;
  }, [items]);

  const canImport = useMemo(() => {
    if (items.length <= 1) {
      const valid = (form.name || '').trim().length > 0 && (form.code || '').trim().length > 0;
      return valid && !duplicateName && !duplicateCode && !saving;
    }
    // For multiple, ensure all are valid and no internal duplicates
    const allValid = items.every((s) => (s.name || '').trim() && (s.code || '').trim());
    // Avoid conflicts with existing subjects by code
    const conflicts = items.some((s) => isDuplicateBy(existingSubjects, s, (x) => (x as SubjectLite).code, normalizeUpper));
    return allValid && !internalDupName && !internalDupCode && !conflicts && !saving;
  }, [form, duplicateName, duplicateCode, saving, items, internalDupName, internalDupCode, existingSubjects]);

  const doImport = async () => {
    if (!rawJson) return;
    setSaving(true);
    setErr('');
    try {
      let payload: any[] = [];
      if (items.length <= 1) {
        const subject: any = {
          name: (form.name || '').trim(),
          code: (form.code || '').trim().toUpperCase(),
          description: ((form.description || '') as string).trim() || null,
          faculty_id: Number(facultyId),
        };
        payload = [subject];
      } else {
        payload = items.map((s) => ({
          name: (s.name || '').trim(),
          code: (s.code || '').trim().toUpperCase(),
          description: ((s.description || '') as string).trim() || null,
          faculty_id: Number(facultyId),
        }));
      }
      await importEntities(universityId, 'subjects', payload, { strategy });
      onImported();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Import Subject{items.length > 1 ? 's' : ''}</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        {err && <div className={styles.error} style={{ marginBottom: '1rem' }}>{err}</div>}

        {step === 1 && (
          <div>
            <p>Upload a JSON export of subject(s).</p>
            <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToReview} className={styles.submitButton}>Continue →</button>
            </div>
          </div>
        )}

        {step === 2 && items.length <= 1 && (
          <div>
            <div className={styles.formGroup}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {duplicateName && (<div style={{ color: '#dc3545', marginTop: 6 }}>A subject with this name already exists. Please adjust.</div>)}
            </div>
            <div className={styles.formGroup}>
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              {duplicateCode && (<div style={{ color: '#dc3545', marginTop: 6 }}>A subject with this code already exists. Please adjust.</div>)}
            </div>
            <div className={styles.formGroup}>
              <label>Description (optional)</label>
              <textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button onClick={() => setStep(1)} className={styles.cancelButton}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!canImport} className={styles.submitButton}>Review & Import →</button>
            </div>
          </div>
        )}

        {step === 2 && items.length > 1 && (
          <div>
            {(internalDupName || internalDupCode) && (
              <div className={styles.error} style={{ marginBottom: '0.5rem' }}>
                Remove or edit duplicates within the imported list before continuing.
              </div>
            )}
            <div style={{ maxHeight: '50vh', overflow: 'auto', border: '1px solid #eee', borderRadius: 8, padding: '0.5rem' }}>
              {items.map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input placeholder="Name" value={s.name} onChange={(e) => {
                    const next = [...items]; next[idx] = { ...s, name: e.target.value }; setItems(next);
                  }} />
                  <input placeholder="Code" value={s.code} onChange={(e) => {
                    const next = [...items]; next[idx] = { ...s, code: e.target.value.toUpperCase() }; setItems(next);
                  }} />
                  <input placeholder="Description (optional)" value={s.description || ''} onChange={(e) => {
                    const next = [...items]; next[idx] = { ...s, description: e.target.value }; setItems(next);
                  }} />
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className={`${buttons.btn} ${buttons.btnDanger}`}>Remove</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', color: '#666', fontSize: '0.9rem' }}>
              Total: {items.length}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button onClick={() => setStep(1)} className={styles.cancelButton}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!canImport} className={styles.submitButton}>Review & Import →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className={styles.formGroup}>
              <label>Import strategy</label>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                <option value="merge">Merge (update existing, add new)</option>
                <option value="replace">Replace (delete matching IDs, insert)</option>
                <option value="skip_existing">Skip existing (insert only new)</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : `Import Subject${items.length > 1 ? 's' : ''}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportSubjectWizard;
