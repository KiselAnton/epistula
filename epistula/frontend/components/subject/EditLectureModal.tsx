import { useEffect, useMemo, useState } from 'react';
import { Lecture } from '../../types';
import { getBackendUrl } from '../../lib/config';
import WysiwygMarkdownEditor from '../common/WysiwygMarkdownEditor';
import buttons from '../../styles/Buttons.module.css';
import modalStyles from '../../styles/Modal.module.css';

interface EditLectureModalProps {
  isOpen: boolean;
  lecture: Lecture | null;
  universityId: string;
  facultyId: string;
  subjectId: string;
  onClose: () => void;
  onSaved: () => void; // caller can refresh list
}

// Helper to convert ISO string to input datetime-local value
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Get local ISO without timezone: YYYY-MM-DDTHH:mm
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

// Helper to convert input datetime-local to ISO string
function localInputValueToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return d.toISOString();
}

export default function EditLectureModal({ isOpen, lecture, universityId, facultyId, subjectId, onClose, onSaved }: EditLectureModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lecture) {
      setTitle(lecture.title || '');
      setDescription(lecture.description || '');
      setScheduledAt(isoToLocalInputValue(lecture.scheduled_at));
      setDurationMinutes(lecture.duration_minutes ?? '');
      setIsActive(lecture.is_active);
    }
  }, [lecture, isOpen]);

  const canSave = useMemo(() => title.trim().length > 0, [title]);

  const handleSave = async () => {
    if (!lecture) return;
    if (!canSave) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Unauthorized');

      const body: any = {
        title: title.trim(),
        description: description || null,
        scheduled_at: localInputValueToIso(scheduledAt),
        duration_minutes: durationMinutes === '' ? null : Number(durationMinutes),
        is_active: isActive,
      };

      const response = await fetch(
        `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures/${lecture.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        let detail = 'Failed to update lecture';
        try {
          const err = await response.json();
          detail = err.detail || detail;
        } catch {}
        throw new Error(detail);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Update lecture failed:', err);
      alert(err.message || 'Failed to update lecture');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !lecture) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 'min(900px, 92vw)', maxHeight: '90vh', overflow: 'auto', background: 'white', borderRadius: 12, padding: '1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Edit Lecture</h2>
          <button onClick={onClose} className={modalStyles.closeButton}>✖</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lecture title"
              style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #ced4da', borderRadius: 8 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description (Markdown)</label>
            <WysiwygMarkdownEditor
              value={description}
              onChange={setDescription}
              onSave={handleSave}
              isSaving={saving}
              placeholder="Add a description, outline topics, or reading links..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Scheduled at</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #ced4da', borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Duration (minutes)</label>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') setDurationMinutes('');
                  else setDurationMinutes(Math.max(0, parseInt(v, 10) || 0));
                }}
                placeholder="e.g. 90"
                style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #ced4da', borderRadius: 8 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input id="lecture-published" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <label htmlFor="lecture-published">Published</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button onClick={onClose} className={`${buttons.btn} ${buttons.btnSecondary}`}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave || saving} className={`${buttons.btn} ${buttons.btnPrimary}`}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
