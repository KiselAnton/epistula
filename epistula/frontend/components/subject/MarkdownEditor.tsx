import { useState, useEffect, useRef } from 'react';
import styles from './MarkdownEditor.module.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, onSave, isSaving, placeholder }: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown('**', '**');
    }
    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown('_', '_');
    }
    // Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      insertMarkdown('[', '](url)');
    }
  };

  const insertMarkdown = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length);
      }
    }, 0);
  };

  const handleSave = () => {
    onSave();
    setIsEditing(false);
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    let html = text;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Code inline
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    
    // Lists
    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!isEditing && !value) {
    return (
      <div className={styles.emptyState} onClick={() => setIsEditing(true)}>
        <span className={styles.emptyIcon}>📝</span>
        <p className={styles.emptyText}>Click to add a description...</p>
        <p className={styles.emptyHint}>Use Markdown to format your content</p>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className={styles.viewMode} onClick={() => setIsEditing(true)}>
        <div className={styles.content}>
          {renderMarkdown(value)}
        </div>
        <div className={styles.editHint}>Click to edit</div>
        {/* Explicit edit button for accessibility (mobile/non-hover) */}
        <button
          type="button"
          className={styles.editToggle}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          aria-label="Edit description"
          title="Edit"
        >
          ✏️ Edit
        </button>
      </div>
    );
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('# ', '')}
            title="Heading 1"
            type="button"
          >
            H1
          </button>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('## ', '')}
            title="Heading 2"
            type="button"
          >
            H2
          </button>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('### ', '')}
            title="Heading 3"
            type="button"
          >
            H3
          </button>
        </div>
        
        <div className={styles.toolbarGroup}>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('**', '**')}
            title="Bold (Ctrl+B)"
            type="button"
          >
            <strong>B</strong>
          </button>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('_', '_')}
            title="Italic (Ctrl+I)"
            type="button"
          >
            <em>I</em>
          </button>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('`', '`')}
            title="Code"
            type="button"
          >
            {'<>'}
          </button>
        </div>
        
        <div className={styles.toolbarGroup}>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('[', '](url)')}
            title="Link (Ctrl+K)"
            type="button"
          >
            🔗
          </button>
          <button
            className={styles.toolButton}
            onClick={() => insertMarkdown('* ', '')}
            title="Bullet list"
            type="button"
          >
            • List
          </button>
        </div>

        <div className={styles.toolbarGroup} style={{ marginLeft: 'auto' }}>
          <button
            className={`${styles.toolButton} ${showPreview ? styles.active : ''}`}
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle preview"
            type="button"
          >
            👁️ Preview
          </button>
        </div>
      </div>

      <div className={styles.editorArea}>
        {!showPreview ? (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Start typing... Use Markdown for formatting\n\nExamples:\n# Heading 1\n## Heading 2\n**bold** _italic_\n* List item\n[link](url)\n`code`"}
            disabled={isSaving}
          />
        ) : (
          <div className={styles.preview}>
            {renderMarkdown(value)}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <div className={styles.hint}>
          <kbd>Ctrl</kbd> + <kbd>S</kbd> to save • <kbd>Ctrl</kbd> + <kbd>B</kbd> bold • <kbd>Ctrl</kbd> + <kbd>I</kbd> italic
        </div>
        <div className={styles.actionButtons}>
          <button
            className={styles.cancelButton}
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
