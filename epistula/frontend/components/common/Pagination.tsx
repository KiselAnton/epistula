/**
 * Reusable pagination component
 */
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '2rem',
        padding: '1rem',
      }}
    >
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        style={{
          padding: '0.5rem 1rem',
          background: currentPage === 1 ? '#e9ecef' : '#007bff',
          color: currentPage === 1 ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Previous
      </button>
      <span style={{ fontSize: '0.9rem', color: '#666' }}>
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        style={{
          padding: '0.5rem 1rem',
          background: currentPage === totalPages ? '#e9ecef' : '#007bff',
          color: currentPage === totalPages ? '#6c757d' : 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Next
      </button>
    </div>
  );
}
