import { SubjectProfessor } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';

interface SubjectProfessorsSectionProps {
  professors: SubjectProfessor[];
  universityId: string;
  onAddProfessor: () => void;
  onRemoveProfessor: (professorId: number) => void;
  removingProfessor: number | null;
}

export default function SubjectProfessorsSection({
  professors,
  universityId,
  onAddProfessor,
  onRemoveProfessor,
  removingProfessor
}: SubjectProfessorsSectionProps) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Teaching Professors ({professors.length})</h2>
        <Button variant="primary" onClick={onAddProfessor}>
          + Assign Professor
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
          background: 'white',
          border: '2px dashed #dee2e6',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👨‍🏫</div>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>No professors assigned to this subject yet.</p>
          <p style={{ color: '#999', fontSize: '0.9rem' }}>Assign professors to allow them to create lectures.</p>
        </div>
      )}
    </div>
  );
}
