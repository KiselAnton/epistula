/**
 * Reusable empty state component
 */
import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, actionButton }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        background: '#f8f9fa',
        borderRadius: '12px',
        border: '2px dashed #dee2e6',
      }}
    >
      <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>{icon}</span>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>{title}</h3>
      {description && <p style={{ margin: '0 0 1.5rem 0', color: '#6c757d' }}>{description}</p>}
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#5568d3')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#667eea')}
        >
          {actionButton.text}
        </button>
      )}
    </div>
  );
}
