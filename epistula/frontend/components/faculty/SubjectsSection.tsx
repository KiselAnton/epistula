import { useRouter } from 'next/router';
import { Subject } from '../../types';
import { exportEntities } from '../../utils/dataTransfer.api';
import MarkdownDisplay from '../common/MarkdownDisplay';
import styles from './SubjectsSection.module.css';

interface SubjectsSectionProps {
  subjects: Subject[];
  universityId: string;
  facultyId: string;
  isTemp?: boolean;
}

export default function SubjectsSection({ subjects, universityId, facultyId, isTemp }: SubjectsSectionProps) {
  const router = useRouter();
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
  const isStudent = user?.role === 'student';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Subjects ({subjects.length})</h2>
        {!isStudent && (
        <button
          onClick={() => router.push(`/university/${universityId}/faculty/${facultyId}/subjects`)}
          className={styles.manageButton}
        >
          Manage Subjects
        </button>
        )}
      </div>

      {subjects.length > 0 ? (
        <div className={styles.grid}>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              onClick={() => router.push(`/university/${universityId}/faculty/${facultyId}/subject/${subject.id}`)}
              className={styles.card}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{subject.name}</h3>
                <div className={styles.cardActions}>
                  {!isStudent && (
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
                    className={styles.exportButton}
                  >
                    Export
                  </button>
                  )}
                  <span className={subject.is_active ? styles.badgeActive : styles.badgeHidden}>
                    {subject.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className={styles.description}>
                <strong>Code:</strong> {subject.code}
              </p>
              {subject.description && (
                <div className={styles.info}>
                  <MarkdownDisplay content={subject.description} variant="compact" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📚</span>
          <p className={styles.emptyText}>No subjects created yet.</p>
          <p className={styles.emptyHint}>
            Click &ldquo;Manage Subjects&rdquo; to create your first subject.
          </p>
        </div>
      )}
    </div>
  );
}
