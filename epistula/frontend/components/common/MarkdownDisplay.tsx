import React from 'react';
import styles from './MarkdownDisplay.module.css';

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
 * Safe Markdown renderer for displaying user-provided content.
 * Renders a subset of Markdown without using dangerouslySetInnerHTML.
 */
export default function MarkdownDisplay({ content, className, variant = 'default' }: MarkdownDisplayProps) {
  if (!content) return null;

  // Preprocess: if users put headings mid-line like "... ## Title", insert a line break
  // before level-2+ headings so they render nicely. This deviates slightly from strict
  // Markdown but matches common quick-entry behavior in cards.
  const normalized = content.replace(/(^|[^\n])\s(#{2,6})\s/g, (_m, p1, hashes) => `${p1}\n${hashes} `);

  const renderLine = (line: string, index: number): React.ReactNode => {
    // Headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className={styles.h3}>{processInline(line.slice(4))}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className={styles.h2}>{processInline(line.slice(3))}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className={styles.h1}>{processInline(line.slice(2))}</h1>;
    }

    // Lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={index} className={styles.li}>{processInline(line.slice(2))}</li>;
    }

    // Code blocks (simple single-line detection; multi-line handled separately)
    if (line.startsWith('```')) {
      return null; // Handle multi-line code blocks separately
    }

    // Blockquotes
    if (line.startsWith('> ')) {
      return <blockquote key={index} className={styles.blockquote}>{processInline(line.slice(2))}</blockquote>;
    }

    // Empty lines
    if (line.trim() === '') {
      return <br key={index} />;
    }

    // Regular paragraph
    return <p key={index} className={styles.p}>{processInline(line)}</p>;
  };

  const processInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className={styles.strong}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Italic *text* or _text_
      const italicMatch = remaining.match(/([*_])(.+?)\1/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, italicMatch.index)}</span>);
        }
        parts.push(<em key={key++} className={styles.em}>{italicMatch[2]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
        continue;
      }

      // Code `code`
      const codeMatch = remaining.match(/`(.+?)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        if (codeMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, codeMatch.index)}</span>);
        }
        parts.push(<code key={key++} className={styles.code}>{codeMatch[1]}</code>);
        remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
        continue;
      }

      // Link [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch && linkMatch.index !== undefined) {
        if (linkMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, linkMatch.index)}</span>);
        }
        parts.push(
          <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
        continue;
      }

      // No more matches, add the rest
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    return parts;
  };

  // Parse content
  const lines = normalized.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let elemKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block detection
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={elemKey++} className={styles.pre}>
            <code className={styles.codeBlock}>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // List accumulation
    if (line.startsWith('* ') || line.startsWith('- ')) {
      currentList.push(renderLine(line, i));
    } else {
      // Flush list if we have one
      if (currentList.length > 0) {
        elements.push(<ul key={elemKey++} className={styles.ul}>{currentList}</ul>);
        currentList = [];
      }
      elements.push(renderLine(line, i));
    }
  }

  // Flush any remaining list
  if (currentList.length > 0) {
    elements.push(<ul key={elemKey++} className={styles.ul}>{currentList}</ul>);
  }

  const variantClass = variant === 'compact' ? styles.compact : '';
  return <div className={`${styles.markdown} ${variantClass} ${className || ''}`}>{elements}</div>;
}
