import { FacultyStudent } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';

interface FacultyStudentsSectionProps {
  students: FacultyStudent[];
  universityId: string;
  onAddStudent: () => void;
  onRemoveStudent: (studentId: number) => void;
  removingStudent: number | null;
}

export default function FacultyStudentsSection({
  students,
  universityId,
  onAddStudent,
  onRemoveStudent,
  removingStudent
}: FacultyStudentsSectionProps) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Faculty Students ({students.length})</h2>
        <Button variant="success" onClick={onAddStudent}>
          + Create Student
        </Button>
      </div>
      
      {students.length > 0 ? (
        <UserListTable
          universityId={universityId}
          rows={students.map<UserListItem>(s => ({
            id: s.student_id,
            name: s.student_name,
            email: s.student_email,
            status: s.is_active ? 'active' : 'inactive',
            dateIso: s.assigned_at,
            avatar: '👤'
          }))}
          dateLabel="Assigned Date"
          renderActions={(row) => (
            <Button
              variant="danger"
              size="small"
              onClick={() => onRemoveStudent(Number(row.id))}
              disabled={removingStudent === Number(row.id)}
            >
              {removingStudent === Number(row.id) ? 'Removing...' : 'Remove'}
            </Button>
          )}
        />
      ) : (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>👥</span>
          <p style={{ color: '#6c757d', margin: 0 }}>No students assigned to this faculty yet.</p>
        </div>
      )}
    </div>
  );
}
