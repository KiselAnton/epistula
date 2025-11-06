/**
 * Skeleton loading components for better perceived performance
 */

import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  style = {},
  className = ''
}) => {
  const styleObj: React.CSSProperties = { width, height, borderRadius, ...style };
  return (
    <div
      className={`${styles.skeleton} ${className}`.trim()}
      style={styleObj}
    />
  );
};

/**
 * Skeleton for table rows
 */
export const TableRowSkeleton: React.FC<{ columns: number }> = ({ columns }) => {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className={styles.tableCell}>
          <Skeleton height="16px" />
        </td>
      ))}
    </tr>
  );
};

/**
 * Skeleton for card components
 */
export const CardSkeleton: React.FC = () => {
  return (
    <div className={styles.card}>
      <Skeleton width="60%" height="24px" className={styles.titleSkeleton} />
      <Skeleton width="100%" height="16px" className={styles.lineSkeleton} />
      <Skeleton width="80%" height="16px" />
    </div>
  );
};

/**
 * Skeleton for user list
 */
export const UserListSkeleton: React.FC = () => {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={styles.userListItem}>
          <Skeleton width="40px" height="40px" borderRadius="50%" />
          <div className={styles.userContent}>
            <Skeleton width="200px" height="18px" className={styles.nameSkeleton} />
            <Skeleton width="150px" height="14px" />
          </div>
          <Skeleton width="80px" height="32px" borderRadius="16px" />
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton for subject cards grid
 */
export const SubjectGridSkeleton: React.FC = () => {
  return (
    <div className={styles.subjectGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton for page header
 */
export const PageHeaderSkeleton: React.FC = () => {
  return (
    <div className={styles.pageHeader}>
      <Skeleton width="300px" height="32px" className={styles.titleSkeleton} />
      <Skeleton width="200px" height="20px" />
    </div>
  );
};

/**
 * Global styles for shimmer animation - no longer needed, using CSS modules
 */
export const SkeletonStyles = () => null;
