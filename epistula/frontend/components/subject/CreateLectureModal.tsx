import { useState } from 'react';
import buttons from '../../styles/Buttons.module.css';
import modalStyles from '../../styles/Modal.module.css';

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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          width: '90%',
          maxWidth: '600px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Create New Lecture</h2>
          <button
            onClick={handleClose}
            disabled={creating}
            className={modalStyles.closeButton}
            style={{ opacity: creating ? 0.5 : 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: '#f8d7da',
            color: '#721c24',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Title <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={creating}
              placeholder="e.g., Introduction to Programming"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={creating}
              placeholder="Brief description of the lecture content..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.scheduled_at || ''}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value || null })}
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration_minutes || ''}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                disabled={creating}
                placeholder="e.g., 90"
                min="1"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
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
