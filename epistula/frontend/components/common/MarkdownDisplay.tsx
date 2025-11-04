import React from 'react';
import dynamic from 'next/dynamic';
import styles from './MarkdownDisplay.module.css';

// Import markdown preview dynamically to avoid SSR issues
const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
);

interface MarkdownDisplayProps {
  content: string;
  className?: string;
  /**
   * Visual density preset for embedding markdown in small UI (cards, lists).
   * "compact" trims margins, slightly reduces font sizes, and clamps blocks to two lines.
   */
  variant?: 'default' | 'compact';
}

/**
 * Markdown renderer for displaying user-provided content.
 * Uses @uiw/react-markdown-preview for full GitHub-flavored markdown support.
 */
export default function MarkdownDisplay({ content, className, variant = 'default' }: MarkdownDisplayProps) {
  if (!content) return null;

  const variantClass = variant === 'compact' ? styles.compact : '';
  // Sanitize content by stripping raw HTML video/audio tags before rendering
  const sanitizeContent = (src: string) =>
    src.replace(/<\s*(video|audio)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
       .replace(/<\s*(source|track)[^>]*>/gi, '');
  const safeContent = sanitizeContent(content);
  
  return (
    <div className={`${styles.markdown} ${variantClass} ${className || ''}`} data-color-mode="light">
      <MarkdownPreview 
        source={safeContent}
        style={{ 
          backgroundColor: 'transparent',
          padding: 0,
          fontSize: variant === 'compact' ? '0.9rem' : 'inherit'
        }}
        wrapperElement={{
          'data-color-mode': 'light'
        }}
      />
    </div>
  );
}
