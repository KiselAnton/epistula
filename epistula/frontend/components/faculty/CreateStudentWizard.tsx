import { useState } from 'react';

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
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
      onClick={() => !creating && onClose()}
    >
      <div
        style={{
          background: 'white', borderRadius: 12, padding: '1.75rem', width: '95%', maxWidth: 560,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Create Student</h2>
          <button
            onClick={() => !creating && onClose()}
            disabled={creating}
            style={{ border: 'none', background: 'transparent', fontSize: '1.5rem', color: '#666', cursor: creating ? 'not-allowed' : 'pointer' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p style={{ marginTop: 0, color: '#666' }}>The student will be automatically assigned to this faculty.</p>

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #dc3545', color: '#dc3545', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student name"
              required
              disabled={creating}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #dee2e6', borderRadius: 8 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              required
              disabled={creating}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #dee2e6', borderRadius: 8 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="Minimum 6 characters"
              required
              disabled={creating}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #dee2e6', borderRadius: 8 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              style={{ padding: '0.75rem 1.25rem', borderRadius: 8, border: '1px solid #dee2e6', background: '#f8f9fa', cursor: creating ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              style={{ padding: '0.75rem 1.25rem', borderRadius: 8, border: 'none', background: '#28a745', color: 'white', fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}
            >
              {creating ? 'Creating…' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
