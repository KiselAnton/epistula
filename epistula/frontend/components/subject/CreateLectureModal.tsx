import { useState } from 'react';
import buttons from '../../styles/Buttons.module.css';
import styles from '../../styles/SharedModal.module.css';

interface CreateLectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: LectureFormData) => Promise<void>;
}

export interface LectureFormData {
  title: string;
  description: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
}

export default function CreateLectureModal({ isOpen, onClose, onCreate }: CreateLectureModalProps) {
  const [formData, setFormData] = useState<LectureFormData>({
    title: '',
    description: '',
    scheduled_at: null,
    duration_minutes: null
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    setCreating(true);
    try {
      await onCreate(formData);
      // Reset form
      setFormData({
        title: '',
        description: '',
        scheduled_at: null,
        duration_minutes: null
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create lecture');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setFormData({
        title: '',
        description: '',
        scheduled_at: null,
        duration_minutes: null
      });
      setError('');
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleClose}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Create New Lecture</h2>
          <button
            onClick={handleClose}
            disabled={creating}
            className={styles.closeButton}
            style={{ opacity: creating ? 0.5 : 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldLabel}>
            <label className={styles.fieldLabelText}>
              Title <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={creating}
              placeholder="e.g., Introduction to Programming"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.fieldLabel}>
            <label className={styles.fieldLabelText}>
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={creating}
              placeholder="Brief description of the lecture content..."
              rows={4}
              className={styles.textarea}
            />
          </div>

          <div className={styles.formGrid}>
            <div>
              <label className={styles.fieldLabelText}>
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                name="scheduled_at"
                value={formData.scheduled_at || ''}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value || null })}
                disabled={creating}
                className={styles.input}
              />
            </div>

            <div>
              <label className={styles.fieldLabelText}>
                Duration (minutes)
              </label>
              <input
                type="number"
                name="duration_minutes"
                value={formData.duration_minutes || ''}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                disabled={creating}
                placeholder="e.g., 90"
                min="1"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={handleClose}
              disabled={creating}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className={`${buttons.btn} ${buttons.btnPrimary}`}
            >
              {creating ? 'Creating...' : 'Create Lecture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
