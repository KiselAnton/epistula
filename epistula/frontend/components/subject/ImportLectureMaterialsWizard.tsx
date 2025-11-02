import React, { useMemo, useState } from 'react';
import styles from '../../styles/Faculties.module.css';
import buttons from '../../styles/Buttons.module.css';
import { importEntities } from '../../utils/dataTransfer.api';

interface ImportLectureMaterialsWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string | number;
  lectureId: string | number;
  onImported: () => void;
}

interface MaterialLite {
  id?: number;
  lecture_id?: number;
  title: string;
  content: string;
  material_type?: string;
  order_number?: number | null;
}

const ImportLectureMaterialsWizard: React.FC<ImportLectureMaterialsWizardProps> = ({ isOpen, onClose, universityId, lectureId, onImported }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawJson, setRawJson] = useState<any | null>(null);
  const [err, setErr] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<MaterialLite[]>([]);

  const handleFile = async (file: File) => {
    setErr('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json && json.entity_type === 'lecture_materials' && Array.isArray(json.data) && json.data.length > 0) {
        setRawJson(json);
        const list = json.data.map((m: any) => ({
          title: m.title || '',
          content: m.content || '',
          material_type: m.material_type || 'markdown',
          order_number: m.order_number ?? null,
        } as MaterialLite));
        setItems(list);
        setStep(2);
        return;
      }
      if (json && (json.title || json.content)) {
        setRawJson({ entity_type: 'lecture_materials', data: [json] });
        setItems([{ title: json.title || '', content: json.content || '', material_type: json.material_type || 'markdown', order_number: json.order_number ?? null }]);
        setStep(2);
        return;
      }
      throw new Error('Invalid file: not a recognized lecture_materials export');
    } catch (e: any) {
      setErr(e?.message || 'Failed to parse JSON');
    }
  };

  const canProceedToReview = useMemo(() => !!rawJson, [rawJson]);
  const canImport = useMemo(() => items.length > 0 && !saving, [items, saving]);

  const doImport = async () => {
    if (!rawJson) return;
    setSaving(true);
    setErr('');
    try {
      const data = items.map((m) => ({
        title: (m.title || '').trim(),
        content: m.content ?? '',
        material_type: m.material_type || 'markdown',
        order_number: m.order_number ?? null,
        lecture_id: Number(lectureId),
      }));
      await importEntities(universityId, 'lecture_materials', data, { strategy: 'merge' });
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
          <h2>Import Lecture Materials</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">×</button>
        </div>
        {err && <div className={styles.error} style={{ marginBottom: '1rem' }}>{err}</div>}
        {step === 1 && (
          <div>
            <p>Upload a JSON export of lecture_materials.</p>
            <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={onClose} className={styles.cancelButton}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!canProceedToReview} className={styles.submitButton}>Continue →</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ maxHeight: '50vh', overflow: 'auto', border: '1px solid #eee', borderRadius: 8, padding: '0.5rem' }}>
              {items.map((m, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr auto', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input placeholder="Title" value={m.title} onChange={(e) => { const next = [...items]; next[idx] = { ...m, title: e.target.value }; setItems(next); }} />
                  <input placeholder="Content" value={m.content} onChange={(e) => { const next = [...items]; next[idx] = { ...m, content: e.target.value }; setItems(next); }} />
                  <input type="number" placeholder="Order #" value={m.order_number ?? ''} onChange={(e) => { const next = [...items]; next[idx] = { ...m, order_number: e.target.value ? Number(e.target.value) : null }; setItems(next); }} />
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className={`${buttons.btn} ${buttons.btnDanger}`}>Remove</button>
                </div>
              ))}
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
              <div>Using merge strategy to update existing materials and add new ones.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setStep(2)} className={styles.cancelButton}>← Back</button>
              <button onClick={doImport} disabled={!canImport} className={`${buttons.btn} ${buttons.btnSuccess}`}>{saving ? 'Importing…' : 'Import Materials'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportLectureMaterialsWizard;
