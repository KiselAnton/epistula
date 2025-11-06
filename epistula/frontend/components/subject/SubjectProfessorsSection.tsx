import { SubjectProfessor } from '../../types';
import UserListTable, { UserListItem } from '../common/UserListTable';
import Button from '../common/Button';
import styles from './SubjectProfessorsSection.module.css';

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
    <div className={styles.container}>
      <div className={styles.header}>
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
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👨‍🏫</div>
          <p className={styles.emptyText}>No professors assigned to this subject yet.</p>
          <p className={styles.emptyHint}>Assign professors to allow them to create lectures.</p>
        </div>
      )}
    </div>
  );
}
