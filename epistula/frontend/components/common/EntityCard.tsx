/**
 * Reusable Card component for displaying entities
 */
import React from 'react';
import Image from 'next/image';
import MarkdownDisplay from './MarkdownDisplay';
import { getBackendUrl } from '../../utils/api';
import styles from './EntityCard.module.css';

interface EntityCardProps {
  title: string;
  subtitle?: string;
  description?: string | null;
  logoUrl?: string | null;
  icon?: string;
  onClick?: () => void;
  footer?: React.ReactNode;
  badge?: {
    text: string;
    color: string;
  };
}

export default function EntityCard({
  title,
  subtitle,
  description,
  logoUrl,
  icon = '📄',
  onClick,
  footer,
  badge,
}: EntityCardProps) {
  return (
    <div
      onClick={onClick}
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
    >
      {badge && (
        <div
          className={styles.badge}
          style={{ background: badge.color }}
        >
          {badge.text}
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.logoContainer}>
          {logoUrl ? (
            <Image
              src={`${getBackendUrl()}${logoUrl}`}
              alt={title}
              width={60}
              height={60}
              className={styles.logoImage}
            />
          ) : (
            <span className={styles.icon}>{icon}</span>
          )}
        </div>
        <div className={styles.content}>
          <h3 className={styles.title}>
            {title}
          </h3>
          {subtitle && (
            <p className={styles.subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {description && (
        <div className={styles.description}>
          <MarkdownDisplay content={description} variant="compact" />
        </div>
      )}

      {footer && (
        <div className={styles.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}
