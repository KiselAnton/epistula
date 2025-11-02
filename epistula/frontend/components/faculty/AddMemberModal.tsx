import { User } from '../../types';

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6c757d'
            }}
          >
            ×
          </button>
        </div>

        {availableUsers.length > 0 ? (
          <div>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Select a user to assign to this faculty:
            </p>
            <div style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {availableUsers.map((user, index) => (
                <div
                  key={user.id}
                  style={{
                    padding: '1rem',
                    borderBottom: index < availableUsers.length - 1 ? '1px solid #e0e0e0' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>{user.email}</div>
                  </div>
                  <button
                    onClick={() => onAssign(user.id)}
                    disabled={isAssigning}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isAssigning ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      opacity: isAssigning ? 0.6 : 1
                    }}
                  >
                    {isAssigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <p style={{ color: '#6c757d', margin: 0 }}>
              No available users to assign. All users are already assigned to this faculty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
