import { Lecture } from '../../types';
import MarkdownDisplay from '../common/MarkdownDisplay';

interface LecturesSectionProps {
  lectures: Lecture[];
  onCreateLecture: () => void;
  onEditLecture: (lectureId: number) => void;
  onDeleteLecture: (lectureId: number) => void;
  deletingLecture: number | null;
  onTogglePublish?: (lectureId: number, publish: boolean) => void;
  publishingLecture?: number | null;
}

export default function LecturesSection({
  lectures,
  onCreateLecture,
  onEditLecture,
  onDeleteLecture,
  deletingLecture,
  onTogglePublish,
  publishingLecture
}: LecturesSectionProps) {
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Lectures ({lectures.length})</h2>
        <button
          onClick={onCreateLecture}
          style={{
            padding: '0.5rem 1rem',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600
          }}
        >
          + Create Lecture
        </button>
      </div>

      {lectures.length > 0 ? (
        <div style={{
          display: 'grid',
          gap: '1rem'
        }}>
          {lectures.map((lecture) => (
            <div
              key={lecture.id}
              style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>📚</span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{lecture.title}</h3>
                    <span style={{
                      background: lecture.is_active ? '#28a745' : '#6c757d',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600
                    }}>
                      {lecture.is_active ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  {lecture.description && (
                    <div style={{ margin: '0.5rem 0', lineHeight: 1.6 }}>
                      <MarkdownDisplay content={lecture.description} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <span style={{ color: '#999' }}>Scheduled:</span>{' '}
                      <span style={{ color: '#333', fontWeight: 500 }}>{formatDateTime(lecture.scheduled_at)}</span>
                    </div>
                    {lecture.duration_minutes && (
                      <div>
                        <span style={{ color: '#999' }}>Duration:</span>{' '}
                        <span style={{ color: '#333', fontWeight: 500 }}>{formatDuration(lecture.duration_minutes)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  {onTogglePublish && (
                    <button
                      onClick={() => onTogglePublish(lecture.id, !lecture.is_active)}
                      disabled={publishingLecture === lecture.id}
                      style={{
                        padding: '0.5rem 1rem',
                        background: lecture.is_active ? '#6c757d' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: publishingLecture === lecture.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        opacity: publishingLecture === lecture.id ? 0.6 : 1
                      }}
                    >
                      {publishingLecture === lecture.id
                        ? (lecture.is_active ? 'Hiding…' : 'Publishing…')
                        : (lecture.is_active ? 'Hide' : 'Publish')}
                    </button>
                  )}
                  <button
                    onClick={() => onEditLecture(lecture.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ffc107',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteLecture(lecture.id)}
                    disabled={deletingLecture === lecture.id}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: deletingLecture === lecture.id ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      opacity: deletingLecture === lecture.id ? 0.6 : 1
                    }}
                  >
                    {deletingLecture === lecture.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: 'white',
          border: '2px dashed #dee2e6',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>No lectures created yet.</p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Create lectures to provide content for students.</p>
        </div>
      )}
    </div>
  );
}
