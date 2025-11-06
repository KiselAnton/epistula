import React from 'react';
import UserLink from './UserLink';
import Badge from './Badge';
import styles from './UserListTable.module.css';

export interface UserListItem {
  id: number | string;
  name: string;
  email: string;
  // 'active' | 'inactive' | 'completed' | 'withdrawn'
  status: string;
  dateIso: string; // ISO date string
  avatar?: string; // optional emoji/avatar
}

interface UserListTableProps<T extends UserListItem> {
  universityId: string;
  rows: T[];
  dateLabel?: string; // Defaults to 'Created'
  actionsHeader?: string; // Defaults to 'Actions'
  renderActions?: (row: T) => React.ReactNode;
}

const statusClass = (status: string) => {
  switch (status) {
    case 'active': return 'active';
    case 'inactive': return 'inactive';
    case 'completed': return 'completed';
    case 'withdrawn': return 'withdrawn';
    default: return 'inactive';
  }
};

export default function UserListTable<T extends UserListItem>({
  universityId,
  rows,
  dateLabel = 'Created',
  actionsHeader = 'Actions',
  renderActions
}: UserListTableProps<T>) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Email</th>
            <th className={styles.th}>{dateLabel}</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th} style={{ textAlign: 'center' }}>{actionsHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, _index) => (
            <tr key={row.id} className={styles.row}>
              <td className={`${styles.cell}`}>
                <div className={styles.nameCell}>
                  {row.avatar ? <span className={styles.avatar}>{row.avatar}</span> : null}
                  <UserLink universityId={universityId} userId={row.id} name={row.name} />
                </div>
              </td>
              <td className={`${styles.cell} ${styles.email}`}>{row.email}</td>
              <td className={`${styles.cell} ${styles.date}`}>
                {new Date(row.dateIso).toLocaleDateString()}
              </td>
              <td className={styles.cell}>
                <Badge variant={statusClass(row.status) as any}>{row.status}</Badge>
              </td>
              <td className={`${styles.cell} ${styles.actions}`}>
                {renderActions ? React.Children.toArray(renderActions(row) as any) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
