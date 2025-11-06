import { useEffect, useMemo, useState } from 'react';
import { getBackendUrl } from '../../lib/config';
import buttons from '../../styles/Buttons.module.css';
import modalStyles from '../../styles/Modal.module.css';
import styles from './AssignToSubjectModal.module.css';

export interface Faculty { id: number; name: string; code: string; }
export interface Subject { id: number; name: string; code: string; faculty_id: number; }

interface AssignToSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string;
  userId: string; // the professor or student id
  mode: 'professor' | 'student';
  faculties: Faculty[];
  excludeSubjectIds?: number[]; // already assigned/enrolled
  onAssigned: () => void; // parent will refresh
}

export default function AssignToSubjectModal({ isOpen, onClose, universityId, userId, mode, faculties, excludeSubjectIds = [], onAssigned }: AssignToSubjectModalProps) {
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSelectedSubjectId('');
    // If only one faculty, preselect it
    if (faculties.length === 1) {
      setSelectedFacultyId(faculties[0].id);
    } else {
      setSelectedFacultyId('');
    }
  }, [isOpen, faculties]);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!selectedFacultyId) { setSubjects([]); return; }
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Unauthorized');
        const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${selectedFacultyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Failed to load subjects');
        const data: Subject[] = await resp.json();
        const filtered = data.filter(s => !excludeSubjectIds.includes(s.id));
        setSubjects(filtered);
      } catch (e: any) {
        setError(e.message || 'Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };
    loadSubjects();
  }, [selectedFacultyId, universityId, excludeSubjectIds]);

  const canAssign = useMemo(() => !!selectedFacultyId && !!selectedSubjectId, [selectedFacultyId, selectedSubjectId]);

  const handleAssign = async () => {
    if (!canAssign) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Unauthorized');
      const path = mode === 'professor'
        ? `${getBackendUrl()}/api/v1/subjects/${universityId}/${selectedFacultyId}/${selectedSubjectId}/professors`
        : `${getBackendUrl()}/api/v1/subjects/${universityId}/${selectedFacultyId}/${selectedSubjectId}/students`;
      const payload = mode === 'professor' ? { professor_id: Number(userId) } : { student_id: Number(userId) };
      const resp = await fetch(path, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err?.detail || 'Failed to assign');
      }
      onAssigned();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>{mode === 'professor' ? 'Assign Professor to Subject' : 'Enroll Student in Subject'}</h3>
          <button onClick={onClose} className={modalStyles.closeButton}>✖</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formGrid}>
          <div>
            <label className={styles.label}>Faculty</label>
            <select value={selectedFacultyId} onChange={e => setSelectedFacultyId(e.target.value ? Number(e.target.value) : '')} className={styles.select}>
              <option value="">Select faculty…</option>
              {faculties.map(f => <option key={f.id} value={f.id}>{f.name} ({f.code})</option>)}
            </select>
          </div>
          <div>
            <label className={styles.label}>Subject</label>
            <select disabled={!selectedFacultyId || loading} value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')} className={styles.select}>
              <option value="">{loading ? 'Loading…' : 'Select subject…'}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
        </div>

        <div className={styles.footer}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={handleAssign} disabled={!canAssign || saving} className={`${buttons.btn} ${buttons.btnPrimary}`}>{saving ? 'Assigning…' : (mode === 'professor' ? 'Assign' : 'Enroll')}</button>
        </div>
      </div>
    </div>
  );
}
