import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import wizardStyles from './ImportSubjectStudentsWizard.module.css';
import { enrollStudentsInSubject } from '../../utils/subjectStudents.api';

interface ImportSubjectStudentsWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  facultyId: string | number;
  subjectId: string | number;
  existingStudentIds: number[]; // to detect duplicates
  onImported: () => void;
}

type StudentRow = { student_id: number; status?: string };

const ImportSubjectStudentsWizard: React.FC<ImportSubjectStudentsWizardProps> = ({ isOpen, onClose, universityId, facultyId, subjectId, existingStudentIds, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);

  const duplicatesInFile = useMemo(() => {
    if (rows.length <= 1) return false;
    const ids = rows.map(r => String(r.student_id ?? ''));
    return new Set(ids).size !== ids.length;
  }, [rows]);

  const conflictsWithExisting = useMemo(() => {
    return rows.some((r, i) => selected[i] && existingStudentIds.includes(Number(r.student_id)));
  }, [rows, selected, existingStudentIds]);

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Accept export-like format: { entity_type: 'subject_students', data: [...] }
      if (json && json.entity_type === 'subject_students' && Array.isArray(json.data) && json.data.length > 0) {
        setRawJson(json);
        const list = json.data.map((r: any) => ({ student_id: Number(r.student_id), status: r.status || 'active' } as StudentRow));
        setRows(list);
        setSelected(new Array(list.length).fill(true));
        setStep(2);
        return;
      }
      // Accept array of numbers
      if (Array.isArray(json) && json.length > 0 && typeof json[0] !== 'object') {
        const list = (json as any[]).map((v) => ({ student_id: Number(v), status: 'active' } as StudentRow));
        setRawJson({ entity_type: 'subject_students', data: list });
        setRows(list);
        setSelected(new Array(list.length).fill(true));
        setStep(2);
        return;
      }
      // Accept array of objects with student_id
      if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
        const list = (json as any[]).map((r) => ({ student_id: Number((r as any).student_id), status: (r as any).status || 'active' } as StudentRow));
        setRawJson({ entity_type: 'subject_students', data: list });
        setRows(list);
        setSelected(new Array(list.length).fill(true));
        setStep(2);
        return;
      }
      throw new Error('Invalid file: expected subject_students JSON or a list of student IDs');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const canImport = useMemo(() => {
    if (rows.length === 0) return false;
    const anySelected = selected.some(Boolean);
    const allValid = rows.every((r, i) => !selected[i] || Number(r.student_id) > 0);
    return anySelected && allValid && !duplicatesInFile && !conflictsWithExisting && !saving;
  }, [rows, selected, duplicatesInFile, conflictsWithExisting, saving]);

  const doImport = async () => {
    setSaving(true);
    setErr('');
    try {
      const ids = rows.filter((_, i) => selected[i]).map(r => Number(r.student_id));
      const results = await enrollStudentsInSubject(universityId, facultyId, subjectId, ids);
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        setErr(`Imported ${results.length - failed.length}. ${failed.length} failed. Example error: ${failed[0].error || 'Unknown'}`);
      } else {
        onImported();
        onClose();
      }
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
          <h2>Import Subject Students</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>
        {err && <div className={`${styles.error} ${wizardStyles.errorWithMargin}`}>{err}</div>}
        {step === 1 && (
          <div>
            <p>Upload JSON of students to enroll. Accepted formats:</p>
            <ul className={wizardStyles.uploadList}>
              <li>{`{ entity_type: 'subject_students', data: [{ student_id, status? }, ...] }`}</li>
              <li>[123, 456, 789] (array of student IDs)</li>
              <li>Array of objects with a student_id field, e.g. [{`{`}student_id: 123{`}`}, ...]</li>
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
                Resolve duplicates in file or remove entries already enrolled.
              </div>
            )}
            <div className={wizardStyles.previewContainer}>
              {rows.map((r, idx) => (
                <div key={idx} className={wizardStyles.studentRow}>
                  <input type="checkbox" checked={selected[idx]} onChange={(e) => { const next = [...selected]; next[idx] = e.target.checked; setSelected(next); }} />
                  <input type="number" placeholder="Student ID" value={r.student_id ?? ''} onChange={(e) => { const next = [...rows]; next[idx] = { ...r, student_id: Number(e.target.value || 0) }; setRows(next); }} />
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
              <div>Students will be enrolled one by one using the subject API. Existing enrollments are skipped.</div>
            </div>
            <div className={wizardStyles.finalButtonRow}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : 'Import Students'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportSubjectStudentsWizard;
