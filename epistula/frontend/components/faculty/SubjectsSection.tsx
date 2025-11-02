import { useRouter } from 'next/router';
import { Subject } from '../../types';
import { exportEntities } from '../../utils/dataTransfer.api';
import MarkdownDisplay from '../common/MarkdownDisplay';

interface SubjectsSectionProps {
  subjects: Subject[];
  universityId: string;
  facultyId: string;
  isTemp?: boolean;
}

export default function SubjectsSection({ subjects, universityId, facultyId, isTemp }: SubjectsSectionProps) {
  const router = useRouter();

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Subjects ({subjects.length})</h2>
        <button
          onClick={() => router.push(`/university/${universityId}/faculty/${facultyId}/subjects`)}
          style={{
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          Manage Subjects
        </button>
      </div>

      {subjects.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              onClick={() => router.push(`/university/${universityId}/faculty/${facultyId}/subject/${subject.id}`)}
              style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#007bff' }}>{subject.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                        if (!token) { router.push('/'); return; }
                        await exportEntities(
                          Number(universityId),
                          'subjects',
                          [Number(subject.id)],
                          {
                            fromTemp: !!isTemp,
                            token,
                            filenameHint: `university-${universityId}${isTemp ? '-temp' : ''}_subject-${subject.id}_export.json`
                          }
                        );
                      } catch (e: any) {
                        alert(e?.message || 'Export failed');
                      }
                    }}
                    title="Export this subject"
                    style={{ padding: '0.25rem 0.5rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Export
                  </button>
                  <span style={{
                  background: subject.is_active ? '#28a745' : '#dc3545',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600
                }}>
                  {subject.is_active ? 'Active' : 'Inactive'}
                </span>
                </div>
              </div>
              <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <strong>Code:</strong> {subject.code}
              </p>
              {subject.description && (
                <div style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 0 0', lineHeight: '1.4' }}>
                  <MarkdownDisplay content={subject.description} variant="compact" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📚</span>
          <p style={{ color: '#6c757d', margin: 0 }}>No subjects created yet.</p>
          <p style={{ color: '#6c757d', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            Click &ldquo;Manage Subjects&rdquo; to create your first subject.
          </p>
        </div>
      )}
    </div>
  );
}
