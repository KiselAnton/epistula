import { Faculty } from '../../types';
import { getBackendUrl } from '../../lib/config';
import Image from 'next/image';
import styles from './FacultyHeader.module.css';

interface FacultyHeaderProps {
  faculty: Faculty;
  universityId: string;
  onLogoUpdate?: (updatedFaculty: Faculty) => void;
}


export default function FacultyHeader({ faculty, universityId: _universityId, onLogoUpdate: _onLogoUpdate }: FacultyHeaderProps) {
  // Editing moved into the unified wizard; this header is now display-only.

  return (
    <div className={styles.header}>
      <div className={styles.logoContainer}>
        {faculty.logo_url ? (
          <Image
            src={`${getBackendUrl()}${faculty.logo_url}`}
            alt={faculty.name}
            width={120}
            height={120}
            className={styles.logoImage}
          />
        ) : (
          <span className={styles.logoPlaceholder}>🎓</span>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{faculty.name}</h1>
          <span className={`${styles.badge} ${faculty.is_active ? styles.badgeActive : styles.badgeInactive}`}>
            {faculty.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className={styles.metadata}>
          <span><strong>Code:</strong> {faculty.code}</span>
          <span><strong>Short Name:</strong> {faculty.short_name}</span>
        </div>
      </div>
    </div>
  );
}
