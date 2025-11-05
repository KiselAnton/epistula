import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import MainLayout from '../../../../components/layout/MainLayout';
import MarkdownDisplay from '../../../../components/common/MarkdownDisplay';
import { getBackendUrl } from '../../../../lib/config';

interface MyNoteItem {
  lecture_id: number;
  subject_id: number;
  faculty_id: number;
  subject_name: string;
  subject_code: string;
  title: string;  // Changed from lecture_title to match backend
  content: string;
  updated_at: string;
}

export default function MyNotesPage() {
  const router = useRouter();
  const { id } = router.query;
  const [notes, setNotes] = useState<MyNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchNotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        if (!token) { router.push('/'); return; }
        const resp = await fetch(`${getBackendUrl()}/api/v1/universities/${id}/my/notes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.status === 401) {
          localStorage.removeItem('token');
          router.push('/');
          return;
        }
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(txt || 'Failed to load notes');
        }
        const data = await resp.json();
        setNotes(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load notes');
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [id, router]);

  return (
    <>
      <Head><title>Epistula -- My Notes</title></Head>
  <MainLayout breadcrumbs={[{ label: `University ${id}`, href: `/university/${id}` }, 'My Notes']}>
        <div style={{ padding: '2rem' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h1 style={{ margin: 0 }}>📝 My Notes</h1>
              <button onClick={() => router.push(`/university/${id}`)} style={{ padding: '0.5rem 1rem', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>← Back</button>
            </div>
            {loading && <p>Loading notes…</p>}
            {error && <p style={{ color: '#dc3545' }}>{error}</p>}
            {!loading && !error && (
              notes.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {notes.map((n) => (
                    <div 
                      key={`${n.subject_id}-${n.lecture_id}`} 
                      onClick={() => router.push(`/university/${id}/faculty/${n.faculty_id}/subject/${n.subject_id}#lecture-${n.lecture_id}`)}
                      style={{ 
                        border: '1px solid #e0e0e0', 
                        borderRadius: 8, 
                        padding: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        e.currentTarget.style.borderColor = '#007bff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = '#e0e0e0';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>📚</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#007bff' }}>{n.title}</div>
                          <div style={{ color: '#666', fontSize: '0.9rem' }}>{n.subject_name} ({n.subject_code})</div>
                        </div>
                        <div style={{ color: '#999', fontSize: '0.85rem' }}>Updated {new Date(n.updated_at).toLocaleString()}</div>
                      </div>
                      <div style={{ marginTop: '0.5rem', paddingLeft: '2rem' }}>
                        <MarkdownDisplay content={n.content} variant="compact" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  <div style={{ fontSize: '2rem' }}>🗒️</div>
                  <p>You don&apos;t have any notes yet.</p>
                </div>
              )
            )}
          </div>
        </div>
      </MainLayout>
    </>
  );
}
