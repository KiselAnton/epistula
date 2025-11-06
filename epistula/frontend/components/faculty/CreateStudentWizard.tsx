import { useState } from 'react';
import styles from './CreateStudentWizard.module.css';

interface CreateStudentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: string;
  facultyId: string;
  onCreated?: () => void;
}

function getBackendUrl() {
  return 'http://localhost:8000';
}

export default function CreateStudentWizard({ isOpen, onClose, universityId, facultyId, onCreated }: CreateStudentWizardProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in name, email, and password.');
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/';
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/universities/${universityId}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role: 'student',
          faculty_id: parseInt(facultyId, 10)
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data?.detail ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : 'Failed to create student';
        throw new Error(msg);
      }

      // Success
      setName('');
      setEmail('');
      setPassword('');
      onClose();
      onCreated?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to create student');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={() => !creating && onClose()}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Create Student</h2>
          <button
            onClick={() => !creating && onClose()}
            disabled={creating}
            className={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className={styles.description}>The student will be automatically assigned to this faculty.</p>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldLabel}>
            <label className={styles.fieldLabelText}>Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student name"
              required
              disabled={creating}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldLabel}>
            <label className={styles.fieldLabelText}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              required
              disabled={creating}
              className={styles.input}
            />
          </div>

          <div className={styles.fieldLabel}>
            <label className={styles.fieldLabelText}>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="Minimum 6 characters"
              required
              disabled={creating}
              className={styles.input}
            />
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className={styles.buttonSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className={styles.buttonSuccess}
            >
              {creating ? 'Creating…' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
