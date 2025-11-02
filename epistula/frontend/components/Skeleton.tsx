/**
 * Skeleton loading components for better perceived performance
 */

import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

/**
 * Base skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  style = {}
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
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
        <td key={i} style={{ padding: '1rem' }}>
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
    <div style={{ 
      padding: '1.5rem', 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <Skeleton width="60%" height="24px" style={{ marginBottom: '1rem' }} />
      <Skeleton width="100%" height="16px" style={{ marginBottom: '0.5rem' }} />
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
        <div key={i} style={{ 
          padding: '1rem',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <Skeleton width="40px" height="40px" borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width="200px" height="18px" style={{ marginBottom: '0.5rem' }} />
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
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: '1rem',
      marginTop: '1rem'
    }}>
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
    <div style={{ marginBottom: '2rem' }}>
      <Skeleton width="300px" height="32px" style={{ marginBottom: '0.5rem' }} />
      <Skeleton width="200px" height="20px" />
    </div>
  );
};

/**
 * Global styles for shimmer animation
 */
export const SkeletonStyles = () => (
  <style jsx global>{`
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `}</style>
);
