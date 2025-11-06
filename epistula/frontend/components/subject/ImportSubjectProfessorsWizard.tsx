import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import wizardStyles from './ImportSubjectProfessorsWizard.module.css';
import { importEntities } from '../../utils/dataTransfer.api';

interface ImportSubjectProfessorsWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  subjectId: string | number;
  existingProfessorIds: number[]; // from SubjectProfessorsSection
  onImported: () => void;
}

const ImportSubjectProfessorsWizard: React.FC<ImportSubjectProfessorsWizardProps> = ({ isOpen, onClose, universityId, subjectId, existingProfessorIds, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const duplicatesInFile = useMemo(() => {
    if (rows.length <= 1) return false;
    const ids = rows.map(r => String(r.professor_id ?? ''));
    return new Set(ids).size !== ids.length;
  }, [rows]);

  const conflictsWithExisting = useMemo(() => {
    return rows.some((r, i) => selected[i] && existingProfessorIds.includes(Number(r.professor_id)));
  }, [rows, selected, existingProfessorIds]);

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json && json.entity_type === 'subject_professors' && Array.isArray(json.data) && json.data.length > 0) {
        setRawJson(json);
        const list = json.data.map((r: any) => ({ professor_id: r.professor_id, can_edit: !!r.can_edit, is_active: r.is_active !== false }));
        setRows(list);
        setSelected(new Array(list.length).fill(true));
        setStep(2);
        return;
      }
      // Single entry fallback
      if (json && (json.professor_id)) {
        setRawJson({ entity_type: 'subject_professors', data: [json] });
        const list = [{ professor_id: json.professor_id, can_edit: !!json.can_edit, is_active: json.is_active !== false }];
        setRows(list);
        setSelected([true]);
        setStep(2);
        return;
      }
      throw new Error('Invalid file: not a recognized subject_professors export');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const canImport = useMemo(() => {
    if (rows.length === 0) return false;
    const anySelected = selected.some(Boolean);
    return anySelected && !duplicatesInFile && !conflictsWithExisting && !saving;
  }, [rows, selected, duplicatesInFile, conflictsWithExisting, saving]);

  const doImport = async () => {
    if (!rawJson) return;
    setSaving(true);
    setErr('');
    try {
      const data = rows
        .map((r) => ({ ...r, subject_id: Number(subjectId) }))
        .filter((_, _i) => selected[_i])
        .map((r) => { const c = { ...r }; delete (c as any).id; return c; });
      await importEntities(universityId, 'subject_professors', data, { strategy: 'merge' });
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
          <h2>Import Subject Professors</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>
        {err && <div className={`${styles.error} ${wizardStyles.errorWithMargin}`}>{err}</div>}
        {step === 1 && (
          <div>
            <p>Upload a JSON export of subject_professors.</p>
            <ul className={wizardStyles.uploadList}>
              <li>{`{ entity_type: 'subject_professors', data: [{ professor_id, can_edit?, is_active? }, ...] }`}</li>
              <li>Single object fallback: {`{`}professor_id: 123, can_edit: true{`}`}</li>
            </ul>
            <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className={wizardStyles.buttonRow}>
              <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToReview} className={styles.submitButton}>Continue →</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            {(duplicatesInFile || conflictsWithExisting) && (
              <div className={`${styles.error} ${wizardStyles.errorWarning}`}>
                Resolve duplicates in file or remove entries that already exist.
              </div>
            )}
            <div className={wizardStyles.previewContainer}>
              {rows.map((r, idx) => (
                <div key={idx} className={wizardStyles.professorRow}>
                  <input type="checkbox" checked={selected[idx]} onChange={(e) => {
                    const next = [...selected]; next[idx] = e.target.checked; setSelected(next);
                  }} />
                  <input type="number" placeholder="Professor ID" value={r.professor_id ?? ''} onChange={(e) => {
                    const next = [...rows]; next[idx] = { ...r, professor_id: Number(e.target.value || 0) }; setRows(next);
                  }} />
                  <label className={wizardStyles.canEditLabel}>
                    <input type="checkbox" checked={!!r.can_edit} onChange={(e) => {
                      const next = [...rows]; next[idx] = { ...r, can_edit: e.target.checked }; setRows(next);
                    }} /> Can edit
                  </label>
                  <button onClick={() => { setRows(rows.filter((_, i) => i !== idx)); setSelected(selected.filter((_, i) => i !== idx)); }} className={`${buttons.btn} ${buttons.btnDanger}`}>Remove</button>
                </div>
              ))}
            </div>
            <div className={wizardStyles.navigationRow}>
              <button onClick={() => setStep(1)} className={styles.cancelButton}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!canImport} className={styles.submitButton}>Review & Import →</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div className={styles.formGroup}>
              <label>Import strategy</label>
              <div>Using merge strategy to avoid overwriting existing assignments.</div>
            </div>
            <div className={wizardStyles.finalButtonRow}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : 'Import Professors'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportSubjectProfessorsWizard;
