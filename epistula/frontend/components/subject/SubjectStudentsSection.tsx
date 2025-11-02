import { SubjectStudent } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';

interface SubjectStudentsSectionProps {
  students: SubjectStudent[];
  universityId: string;
  onAddStudent: () => void;
  onRemoveStudent: (studentId: number) => void;
  removingStudent: number | null;
}

export default function SubjectStudentsSection({
  students,
  universityId,
  onAddStudent,
  onRemoveStudent,
  removingStudent
}: SubjectStudentsSectionProps) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Enrolled Students ({students.length})</h2>
        <Button variant="success" onClick={onAddStudent}>
          + Enroll Student
        </Button>
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
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: 'white',
          border: '2px dashed #dee2e6',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👨‍🎓</div>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>No students enrolled in this subject yet.</p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Enroll students to allow them to access lectures.</p>
        </div>
      )}
    </div>
  );
}
