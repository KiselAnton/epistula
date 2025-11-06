/**
 * Reusable empty state component
 */
import React from 'react';
import styles from './EmptyState.module.css';

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
    <div className={styles.container}>
      <span className={styles.icon}>{icon}</span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {actionButton && (
        <button
          onClick={actionButton.onClick}
          className={styles.button}
        >
          {actionButton.text}
        </button>
      )}
    </div>
  );
}
