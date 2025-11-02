/**
 * Reusable Card component for displaying entities
 */
import React from 'react';
import Image from 'next/image';
import MarkdownDisplay from './MarkdownDisplay';
import { getBackendUrl } from '../../utils/api';

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
      style={{
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        position: 'relative',
      }}
      onMouseOver={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          e.currentTarget.style.borderColor = '#667eea';
        }
      }}
      onMouseOut={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          e.currentTarget.style.borderColor = '#e0e0e0';
        }
      }}
    >
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: badge.color,
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          {badge.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div
          style={{
            width: '60px',
            height: '60px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: '#f8f9fa',
            flexShrink: 0,
          }}
        >
          {logoUrl ? (
            <Image
              src={`${getBackendUrl()}${logoUrl}`}
              alt={title}
              width={60}
              height={60}
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '2rem' }}>{icon}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.85rem',
                color: '#666',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {description && (
        <div style={{ margin: 0, color: '#666' }}>
          <MarkdownDisplay content={description} variant="compact" />
        </div>
      )}

      {footer && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
