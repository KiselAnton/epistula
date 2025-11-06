import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import wizardStyles from './ImportLectureWizard.module.css';
import { importEntities } from '../../utils/dataTransfer.api';

interface ImportLectureWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  subjectId: string | number;
  onImported: () => void;
}

interface LectureLite {
  id?: number;
  subject_id?: number;
  title: string;
  description?: string | null;
  order_number?: number | null;
  is_published?: boolean;
}

const ImportLectureWizard: React.FC<ImportLectureWizardProps> = ({ isOpen, onClose, universityId, subjectId, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [lectures, setLectures] = useState<LectureLite[]>([]);
  const [form, setForm] = useState<LectureLite>({ title: '', description: '', order_number: null, is_published: false });
  const [strategy, setStrategy] = useState<'merge' | 'replace' | 'skip_existing'>('merge');

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Accept exportEntities for lectures
      if (json && json.entity_type === 'lectures' && Array.isArray(json.data) && json.data.length > 0) {
        setRawJson(json);
        setLectures(json.data);
        const l = json.data[0];
        setForm({
          title: l.title || '',
          description: l.description ?? '',
          order_number: l.order_number ?? null,
          is_published: l.is_published === true,
        });
        setStep(2);
        return;
      }

      // Single lecture object fallback
      if (json && (json.title)) {
        setRawJson({ entity_type: 'lectures', data: [json] });
        setLectures([json]);
        setForm({
          title: json.title || '',
          description: json.description ?? '',
          order_number: json.order_number ?? null,
          is_published: json.is_published === true,
        });
        setStep(2);
        return;
      }

      throw new Error('Invalid file: not a recognized lectures export');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const canImport = useMemo(() => {
    // If exactly one lecture, ensure title not empty
    if (lectures.length === 1) {
      return (form.title || '').trim().length > 0 && !saving;
    }
    return !saving;
  }, [form, lectures.length, saving]);

  const buildPayload = () => {
    if (lectures.length <= 1) {
      const base = { ...(lectures[0] || {}) } as any;
      base.title = (form.title || '').trim();
      base.description = ((form.description || '') as string).trim() || null;
      base.order_number = form.order_number ?? null;
      base.subject_id = Number(subjectId);
      delete base.id;
      return [base];
    }
    // Multiple: remap subject_id for all
    return lectures.map((l: any) => {
      const copy = { ...l };
      copy.subject_id = Number(subjectId);
      delete copy.id;
      return copy;
    });
  };

  const doImport = async () => {
    if (!rawJson) return;
    setSaving(true);
    setErr('');
    try {
      const data = buildPayload();
      await importEntities(universityId, 'lectures', data, { strategy });
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
          <h2>Import Lecture{lectures.length !== 1 ? 's' : ''}</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>

        {err && <div className={`${styles.error} ${wizardStyles.errorWithMargin}`}>{err}</div>}

        {step === 1 && (
          <div>
            <p>Upload a JSON export of lectures.</p>
            <ul className={wizardStyles.uploadList}>
              <li>{`{ entity_type: 'lectures', data: [{ title, description?, order_number?, is_published? }, ...] }`}</li>
              <li>Single object fallback: {`{`}title: Intro, order_number: 1{`}`}</li>
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
            {lectures.length === 1 ? (
              <>
                <div className={styles.formGroup}>
                  <label>Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Description (optional)</label>
                  <textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Lecture number (optional)</label>
                  <input type="number" value={form.order_number ?? ''} onChange={(e) => setForm({ ...form, order_number: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </>
            ) : (
                <div className={styles.formGroup}>
                  <label>Detected {lectures.length} lectures</label>
                  <div className={wizardStyles.note}>They will be imported and attached to this subject.</div>
                </div>
            )}
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
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
                <option value="merge">Merge (update existing, add new)</option>
                <option value="replace">Replace (delete matching IDs, insert)</option>
                <option value="skip_existing">Skip existing (insert only new)</option>
              </select>
            </div>
            <div className={wizardStyles.finalActions}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : `Import Lecture${lectures.length !== 1 ? 's' : ''}`}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportLectureWizard;
