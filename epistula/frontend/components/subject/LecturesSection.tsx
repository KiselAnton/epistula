import { Lecture } from '../../types';
import MarkdownDisplay from '../common/MarkdownDisplay';
import buttons from '../../styles/Buttons.module.css';
import LectureNoteEditor from './LectureNoteEditor';
import styles from './LecturesSection.module.css';

interface LecturesSectionProps {
  lectures: Lecture[];
  onCreateLecture: () => void;
  onEditLecture: (lectureId: number) => void;
  onDeleteLecture: (lectureId: number) => void;
  deletingLecture: number | null;
  onTogglePublish?: (lectureId: number, publish: boolean) => void;
  publishingLecture?: number | null;
  onImportMaterials?: (lectureId: number) => void;
  onExportMaterials?: (lectureId: number) => void;
  onExportLectures?: () => void;
  universityId: string;
  facultyId: string;
  subjectId: string;
  showNoteEditor?: boolean;
}

export default function LecturesSection({
  lectures,
  onCreateLecture,
  onEditLecture,
  onDeleteLecture,
  deletingLecture,
  onTogglePublish,
  publishingLecture,
  onImportMaterials,
  onExportMaterials,
  onExportLectures,
  universityId,
  facultyId,
  subjectId,
  showNoteEditor = true
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Lectures ({lectures.length})</h2>
        <div className={styles.headerActions}>
          {onExportLectures && (
            <button onClick={onExportLectures} className={`${buttons.btn} ${buttons.btnSecondary}`}>Export Lectures</button>
          )}
          <button
            onClick={onCreateLecture}
            className={`${buttons.btn} ${buttons.btnPrimary}`}
          >
            + Create Lecture
          </button>
        </div>
      </div>

      {lectures.length > 0 ? (
        <div className={styles.lecturesGrid}>
          {lectures.map((lecture) => (
            <div
              key={lecture.id}
              className={styles.lectureCard}
            >
              <div className={styles.lectureContent}>
                <div className={styles.lectureMain}>
                  <div className={styles.lectureHeader}>
                    <span className={styles.lectureIcon}>📚</span>
                    <h3 className={styles.lectureTitle}>{lecture.title}</h3>
                    <span className={lecture.is_active ? styles.badgePublished : styles.badgeHidden}>
                      {lecture.is_active ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  {lecture.description && (
                    <div className={styles.lectureDescription}>
                      <MarkdownDisplay content={lecture.description} />
                    </div>
                  )}
                  <div className={styles.lectureMetadata}>
                    <div>
                      <span className={styles.metadataLabel}>Scheduled:</span>{' '}
                      <span className={styles.metadataValue}>{formatDateTime(lecture.scheduled_at)}</span>
                    </div>
                    {lecture.duration_minutes && (
                      <div>
                        <span className={styles.metadataLabel}>Duration:</span>{' '}
                        <span className={styles.metadataValue}>{formatDuration(lecture.duration_minutes)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.lectureActions}>
                  {onTogglePublish && (
                    <button
                      onClick={() => onTogglePublish(lecture.id, !lecture.is_active)}
                      disabled={publishingLecture === lecture.id}
                      className={`${buttons.btn} ${lecture.is_active ? buttons.btnSecondary : buttons.btnSuccess}`}
                    >
                      {publishingLecture === lecture.id
                        ? (lecture.is_active ? 'Hiding…' : 'Publishing…')
                        : (lecture.is_active ? 'Hide' : 'Publish')}
                    </button>
                  )}
                  <button
                    onClick={() => onEditLecture(lecture.id)}
                    className={`${buttons.btn} ${buttons.btnWarning}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteLecture(lecture.id)}
                    disabled={deletingLecture === lecture.id}
                    className={`${buttons.btn} ${buttons.btnDanger}`}
                  >
                    {deletingLecture === lecture.id ? 'Deleting...' : 'Delete'}
                  </button>
                  {onImportMaterials && (
                    <button
                      onClick={() => onImportMaterials(lecture.id)}
                      className={`${buttons.btn} ${buttons.btnSecondary}`}
                    >
                      Import Materials
                    </button>
                  )}
                  {onExportMaterials && (
                    <button
                      onClick={() => onExportMaterials(lecture.id)}
                      className={`${buttons.btn} ${buttons.btnSecondary}`}
                    >
                      Export Materials
                    </button>
                  )}
                </div>
              </div>
              {/* Student private note editor */}
              {showNoteEditor && (
                <div className={styles.noteEditorContainer}>
                  <LectureNoteEditor
                    universityId={universityId}
                    facultyId={facultyId}
                    subjectId={subjectId}
                    lectureId={lecture.id}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📚</div>
          <p className={styles.emptyStateTitle}>No lectures created yet.</p>
          <p className={styles.emptyStateSubtitle}>Create lectures to provide content for students.</p>
        </div>
      )}
    </div>
  );
}
