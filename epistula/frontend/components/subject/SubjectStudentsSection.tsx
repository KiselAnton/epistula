import { SubjectStudent } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';
import styles from './SubjectStudentsSection.module.css';

interface SubjectStudentsSectionProps {
  students: SubjectStudent[];
  universityId: string;
  onAddStudent: () => void;
  onRemoveStudent: (studentId: number) => void;
  removingStudent: number | null;
  onImportStudents?: () => void;
  onExportStudents?: () => void;
}

export default function SubjectStudentsSection({
  students,
  universityId,
  onAddStudent,
  onRemoveStudent,
  removingStudent,
  onImportStudents,
  onExportStudents
}: SubjectStudentsSectionProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Enrolled Students ({students.length})</h2>
        <div className={styles.actions}>
          {onExportStudents && (
            <Button variant="secondary" onClick={onExportStudents}>⬇️ Export</Button>
          )}
          {onImportStudents && (
            <Button variant="secondary" onClick={onImportStudents}>⬆️ Import</Button>
          )}
          <Button variant="success" onClick={onAddStudent}>+ Enroll Student</Button>
        </div>
      </div>

      {students.length > 0 ? (
        <UserListTable
          universityId={universityId}
          rows={students.map<UserListItem>(s => ({
            id: s.student_id,
            name: s.student_name,
            email: s.student_email,
            status: s.status,
            dateIso: s.enrolled_at,
            avatar: '👨\u200d🎓'
          }))}
          dateLabel="Enrolled Date"
          renderActions={(row) => (
            <Button
              variant="danger"
              size="small"
              onClick={() => onRemoveStudent(Number(row.id))}
              disabled={removingStudent === Number(row.id)}
            >
              {removingStudent === Number(row.id) ? 'Unenrolling...' : 'Unenroll'}
            </Button>
          )}
        />
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👨‍🎓</div>
          <p className={styles.emptyText}>No students enrolled in this subject yet.</p>
          <p className={styles.emptyHint}>Enroll students to allow them to access lectures.</p>
        </div>
      )}
    </div>
  );
}
