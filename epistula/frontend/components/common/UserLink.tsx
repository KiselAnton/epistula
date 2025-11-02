import Link from 'next/link';
import styles from './UserLink.module.css';

interface UserLinkProps {
  universityId: string;
  userId: number | string;
  name: string;
  underline?: boolean;
  className?: string;
}

/**
 * Reusable clickable user name linking to the user profile page.
 * Route: /university/{universityId}/users/{userId}
 */
export default function UserLink({
  universityId,
  userId,
  name,
  underline = true,
  className
}: UserLinkProps) {
  const href = `/university/${universityId}/users/${userId}`;
  return (
    <Link href={href} legacyBehavior>
      <a className={`${styles.link} ${underline ? '' : ''} ${className || ''}`.trim()}>{name}</a>
    </Link>
  );
}
