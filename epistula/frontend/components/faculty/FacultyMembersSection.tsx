import { FacultyProfessor } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';

interface FacultyMembersSectionProps {
  professors: FacultyProfessor[];
  universityId: string;
  onAddProfessor: () => void;
  onRemoveProfessor: (professorId: number) => void;
  removingProfessor: number | null;
}

export default function FacultyMembersSection({
  professors,
  universityId,
  onAddProfessor,
  onRemoveProfessor,
  removingProfessor
}: FacultyMembersSectionProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Faculty Members ({professors.length})</h2>
        <Button variant="primary" onClick={onAddProfessor}>
          + Add Professor
        </Button>
      </div>
      {professors.length > 0 ? (
        <UserListTable
          universityId={universityId}
          rows={professors.map<UserListItem>(p => ({
            id: p.professor_id,
            name: p.professor_name,
            email: p.professor_email,
            status: p.is_active ? 'active' : 'inactive',
            dateIso: p.assigned_at,
            avatar: '👨\u200d🏫'
          }))}
          dateLabel="Assigned Date"
          renderActions={(row) => (
            <Button
              variant="danger"
              size="small"
              onClick={() => onRemoveProfessor(Number(row.id))}
              disabled={removingProfessor === Number(row.id)}
            >
              {removingProfessor === Number(row.id) ? 'Removing...' : 'Remove'}
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
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>👨‍🏫</span>
          <p style={{ color: '#6c757d', margin: 0 }}>No professors assigned to this faculty yet.</p>
          <p style={{ color: '#6c757d', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            Assign professors to allow them to create subjects in this faculty.
          </p>
        </div>
      )}
    </div>
  );
}
