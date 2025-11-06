import { User } from '../../types';
import styles from './AddMemberModal.module.css';

interface AddMemberModalProps {
  isOpen: boolean;
  title: string;
  availableUsers: User[];
  onClose: () => void;
  onAssign: (userId: number) => void;
  isAssigning: boolean;
}

export default function AddMemberModal({
  isOpen,
  title,
  availableUsers,
  onClose,
  onAssign,
  isAssigning
}: AddMemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>

        {availableUsers.length > 0 ? (
          <div>
            <p className={styles.description}>
              Select a user to assign to this faculty:
            </p>
            <div className={styles.userList}>
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className={styles.userCard}
                >
                  <div>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                  </div>
                  <button
                    onClick={() => onAssign(user.id)}
                    disabled={isAssigning}
                    className={styles.assignButton}
                    style={{ opacity: isAssigning ? 0.6 : 1 }}
                  >
                    {isAssigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No available users to assign. All users are already assigned to this faculty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
