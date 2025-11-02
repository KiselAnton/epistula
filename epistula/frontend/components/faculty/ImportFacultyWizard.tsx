import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import { importFacultyFull } from '../../utils/dataTransfer.api';

export interface FacultyLite {
  id?: number;
  name: string;
  short_name: string;
  code: string;
  description?: string | null;
  is_active?: boolean;
}

interface ImportFacultyWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  existingFaculties: FacultyLite[];
  onImported: () => void;
}

/**
 * Wizard to import a previously exported Faculty (with relations) JSON.
 * Steps:
 * 1) Upload JSON and validate structure
 * 2) Review & edit Faculty fields (prevent name/code conflicts)
 * 3) Choose strategy and import
 */
const ImportFacultyWizard: React.FC<ImportFacultyWizardProps> = ({ isOpen, onClose, universityId, existingFaculties, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FacultyLite>({ name: '', short_name: '', code: '', description: '', is_active: true });
  const [strategy, setStrategy] = useState<'merge' | 'replace' | 'skip_existing'>('merge');

  const duplicateName = useMemo(() => {
    const name = form.name.trim().toLowerCase();
    return !!existingFaculties.find(f => f.name.trim().toLowerCase() === name);
  }, [form.name, existingFaculties]);

  const duplicateCode = useMemo(() => {
    const code = form.code.trim().toUpperCase();
    return !!existingFaculties.find(f => f.code.trim().toUpperCase() === code);
  }, [form.code, existingFaculties]);

  // Don't early-return before hooks; use conditional in JSX instead

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Accept either the full export format or a minimalist faculty-only structure
      if (json && json.export_type === 'faculty_with_relations' && json.faculty) {
        setRawJson(json);
        const f = json.faculty;
        setForm({
          name: f.name || '',
          short_name: f.short_name || '',
          code: (f.code || '').toUpperCase(),
          description: f.description ?? '',
          is_active: f.is_active !== false,
        });
        setStep(2);
        return;
      }

      // Fallback: detect standard export of a single faculty
      if (json && json.entity_type === 'faculties' && Array.isArray(json.data) && json.data.length > 0) {
        const f = json.data[0];
        const wrapped = {
          export_type: 'faculty_with_relations',
          faculty_id: f.id ?? null,
          source_schema: json.source_schema ?? '',
          exported_at: json.exported_at ?? new Date().toISOString(),
          faculty: f,
          relations: {},
        };
        setRawJson(wrapped);
        setForm({
          name: f.name || '',
          short_name: f.short_name || '',
          code: (f.code || '').toUpperCase(),
          description: f.description ?? '',
          is_active: f.is_active !== false,
        });
        setStep(2);
        return;
      }

      throw new Error('Invalid file: not a recognized faculty export');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const canImport = useMemo(() => {
    const valid = form.name.trim().length > 0 && form.code.trim().length > 0 && form.short_name.trim().length > 0;
    // Allow import even if duplicate, but strongly discourage — keep button enabled only when conflicts are resolved
    return valid && !duplicateName && !duplicateCode && !saving;
  }, [form, duplicateName, duplicateCode, saving]);

  const doImport = async () => {
    if (!rawJson) return;
    setSaving(true);
    setErr('');
    try {
      const payload = { ...rawJson };
      payload.faculty = {
        ...(payload.faculty || {}),
        name: form.name.trim(),
        short_name: form.short_name.trim(),
        code: form.code.trim().toUpperCase(),
        description: (form.description || '').trim() || null,
        is_active: form.is_active !== false,
      };

      await importFacultyFull(universityId, payload, { strategy });
      onImported();
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  return (!isOpen ? null : (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Import Faculty</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        {err && (
          <div className={styles.error} style={{ marginBottom: '1rem' }}>{err}</div>
        )}

        {step === 1 && (
          <div>
            <p>Upload a JSON export of a faculty (created via Export on a faculty).</p>
            <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToReview} className={styles.submitButton}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className={styles.formGroup}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {duplicateName && (<div style={{ color: '#dc3545', marginTop: 6 }}>A faculty with this name already exists. Please adjust.</div>)}
            </div>
            <div className={styles.formGroup}>
              <label>Short name</label>
              <input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              {duplicateCode && (<div style={{ color: '#dc3545', marginTop: 6 }}>A faculty with this code already exists. Please adjust.</div>)}
            </div>
            <div className={styles.formGroup}>
              <label>Description (optional)</label>
              <textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className={styles.formGroup}>
              <label>
                <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active
              </label>
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

            <div className={styles.formGroup}>
              <label>Summary</label>
              <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 8, padding: '0.75rem 1rem' }}>
                <div><strong>Name:</strong> {form.name}</div>
                <div><strong>Short name:</strong> {form.short_name}</div>
                <div><strong>Code:</strong> {form.code}</div>
                {rawJson?.relations && (
                  <div style={{ marginTop: 8, color: '#666' }}>
                    <em>Includes relations:</em>
                    <ul>
                      {Object.entries(rawJson.relations).map(([k, v]: any) => (
                        <li key={k}>{k}: {Array.isArray(v) ? v.length : (v?.length ?? 0)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : 'Import Faculty'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  ));
};

export default ImportFacultyWizard;
