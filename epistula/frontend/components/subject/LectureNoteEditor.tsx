import { useEffect, useState } from 'react';
import { getBackendUrl } from '../../lib/config';
import buttons from '../../styles/Buttons.module.css';
import styles from './LectureNoteEditor.module.css';
import WysiwygMarkdownEditor from '../common/WysiwygMarkdownEditor';

interface LectureNoteEditorProps {
  universityId: string;
  facultyId: string;
  subjectId: string;
  lectureId: number;
  tokenOverride?: string;
}

export default function LectureNoteEditor({ universityId, facultyId, subjectId, lectureId, tokenOverride }: LectureNoteEditorProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch note when opened first time
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchNote = async () => {
      setLoading(true);
      setError(null);
      setStatus(null);
      try {
  const token = tokenOverride ?? localStorage.getItem('token');
        if (!token) { setError('Not authenticated'); return; }
        const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures/${lectureId}/notes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (cancelled) return;
        if (resp.status === 401) {
          localStorage.removeItem('token');
          setError('Session expired. Please sign in again.');
          return;
        }
        if (resp.status === 404) {
          // No existing note
          setContent('');
          setStatus('No note yet. Create one below.');
        } else if (resp.status === 200) {
          const data = await resp.json();
          setContent(data?.content ?? '');
          setStatus(`Last updated: ${new Date(data?.updated_at).toLocaleString()}`);
        } else if (resp.status === 403) {
          setError("You're not allowed to add notes for this lecture.");
        } else {
          setError('Failed to load note');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load note');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchNote();
    return () => { cancelled = true; };
  }, [open, universityId, facultyId, subjectId, lectureId, tokenOverride]);

  // Defensive: remove <video>/<audio> tags from markdown prior to saving
  // BlockNote already restricts these for students, but keep sanitization as a safety net.
  const sanitizeMarkdown = (src: string) =>
    src
      .replace(/<\s*(video|audio)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(source|track)[^>]*>/gi, '');

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
  const token = tokenOverride ?? localStorage.getItem('token');
      if (!token) { setError('Not authenticated'); return; }
      const resp = await fetch(`${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/lectures/${lectureId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: sanitizeMarkdown(content) })
      });
      if (resp.status === 401) {
        localStorage.removeItem('token');
        setError('Session expired. Please sign in again.');
        return;
      }
      if (resp.status === 403) {
        setError("You're not allowed to save notes for this lecture.");
        return;
      }
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || 'Failed to save note');
      }
      const data = await resp.json();
      setStatus(`Saved at ${new Date(data?.updated_at).toLocaleString()}`);
    } catch (e: any) {
      setError(e?.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => setOpen(o => !o)} className={`${buttons.btn} ${buttons.btnSecondary}`}>
          {open ? 'Hide My Note' : '📝 My Note'}
        </button>
        {loading && <span className={styles.statusLoading}>Loading…</span>}
        {status && !loading && <span className={styles.statusSuccess}>{status}</span>}
        {error && <span className={styles.statusError}>{error}</span>}
      </div>
      {open && (
        <div className={styles.editorWrapper}>
          <WysiwygMarkdownEditor
            value={content}
            onChange={setContent}
            onSave={handleSave}
            isSaving={saving}
            placeholder="Write your private note here…"
            userRole="student"
          />
          <div className={styles.actions}>
            <button onClick={handleSave} disabled={saving} className={`${buttons.btn} ${buttons.btnPrimary}`}>
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <span className={styles.charCount}>{content.length} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}
