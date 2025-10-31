import Head from 'next/head';
import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';

type University = {
  id: number;
  name: string;
  code: string;
  schema_name: string;
  description?: string;
  created_at: string;
  is_active: boolean;
};

const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    setToken(t);
    if (u) setUser(JSON.parse(u));
    fetchUniversities();
  }, []);

  const fetchUniversities = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/v1/universities/`);
      if (res.ok) {
        const data = await res.json();
        setUniversities(data);
      }
    } catch (e) {
      // ignore listing errors for now
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!token) {
        setError('You must be logged in.');
        setLoading(false);
        return;
      }
      const res = await fetch(`${getBackendUrl()}/api/v1/universities/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', code: '', description: '' });
        await fetchUniversities();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Failed to create university');
      }
    } catch (err: any) {
      setError('Network error creating university');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Epistula - Dashboard</title>
      </Head>
      <MainLayout breadcrumbs={["Epistula", "Dashboard"]}>
        <div style={{ display: 'grid', gap: 24 }}>
          <section>
            <h2 style={{ marginBottom: 12 }}>Create University {user?.role === 'root' ? '' : '(root only)'}</h2>
            <form onSubmit={handleCreate} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
              <div>
                <label>Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6 }}
                />
              </div>
              <div>
                <label>Code (short, e.g., MIT)</label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6 }}
                />
              </div>
              <div>
                <label>Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 6 }}
                  rows={3}
                />
              </div>
              {error && <div style={{ color: '#ef4444' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ padding: '10px 14px', borderRadius: 6 }}>
                {loading ? 'Creating…' : 'Create University'}
              </button>
            </form>
          </section>

          <section>
            <h2 style={{ marginBottom: 12 }}>Universities</h2>
            {universities.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>No universities yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {universities.map((u) => (
                  <div key={u.id} style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 12
                  }}>
                    <div style={{ fontWeight: 600 }}>{u.name} <span style={{ color: '#94a3b8' }}>({u.code})</span></div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Schema: {u.schema_name} • ID: {u.id}</div>
                    {u.description && <div style={{ marginTop: 6 }}>{u.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </MainLayout>
    </>
  );
}
