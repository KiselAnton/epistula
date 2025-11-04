import { useRef, useState, useEffect } from 'react';
import Showdown from 'showdown';
import styles from './MarkdownEditor.module.css';
import { uploadToStorage } from '../../lib/api';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, onSave, isSaving, placeholder }: MarkdownEditorProps) {
  const [selectedTab, setSelectedTab] = useState<'write' | 'preview'>('write');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#e53e3e');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const converterRef = useRef(new Showdown.Converter({
    // GitHub-flavored markdown options
    strikethrough: true,
    tables: true,
    tasklists: true,
    simpleLineBreaks: true,
    openLinksInNewWindow: true,
    ghCodeBlocks: true,
    parseImgDimensions: true,
    // Allow literal underscores and asterisks
    literalMidWordUnderscores: true,
    literalMidWordAsterisks: true,
    // Disable escaping of HTML entities and tags
    noHeaderId: true,
    // This is the key - set flavor to 'github' to ensure HTML passthrough
  }));
  
  // Configure Showdown flavor and additional options
  useEffect(() => {
    converterRef.current.setFlavor('github');
  }, []);

  // Insert markdown at cursor position
  const insertAtCursor = (insertText: string) => {
    const textarea = document.querySelector(`.${styles.textarea}`) as HTMLTextAreaElement;
    if (!textarea) {
      // If textarea not found, append to end
      onChange(value + insertText);
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newValue = before + insertText + after;
    onChange(newValue);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newPos = start + insertText.length;
        textarea.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Upload handler
  const handleUpload = async (file: File, isImage: boolean) => {
    try {
      const res = await uploadToStorage(file);
      if (!res?.url) throw new Error('Upload failed: no URL returned');
      
      const markdownSyntax = isImage 
        ? `![${file.name}](${res.url})` 
        : `[${file.name}](${res.url})`;
      
      console.log(`Inserted markdown: ${markdownSyntax}`);
      insertAtCursor(markdownSyntax);
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Drag/drop and paste handlers
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const isImage = (file.type || '').startsWith('image/');
      try { await handleUpload(file, isImage); } catch (err) { alert((err as Error).message || 'Upload failed'); }
    }
  };
  const onPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file') {
        const file = it.getAsFile();
        if (file) {
          const isImage = (file.type || '').startsWith('image/');
          try { await handleUpload(file, isImage); } catch (err) { alert((err as Error).message || 'Upload failed'); }
        }
      }
    }
  };

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  const applyColor = (color: string) => {
    insertAtCursor(`<span style='color:${color}'>text</span>`);
    setSelectedColor(color);
    setShowColorPicker(false);
  };

  const predefinedColors = [
    '#e53e3e', '#d69e2e', '#38a169', '#3182ce', '#805ad5', 
    '#d53f8c', '#000000', '#718096', '#f56565', '#ed8936'
  ];

  // Simple sanitizer to strip <video> and <audio> tags from generated HTML
  const sanitizePreviewHtml = (html: string) => {
    try {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        wrapper.querySelectorAll('video, audio, source, track').forEach((el) => el.remove());
        return wrapper.innerHTML;
      }
    } catch {}
    // Fallback: naive removal if DOM not available
    return html
      .replace(/<\s*(video|audio)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(source|track)[^>]*>/gi, '');
  };

  return (
    <div className={styles.editorContainer} onDrop={onDrop} onPaste={onPaste} onDragOver={(e) => e.preventDefault()}>
      {/* Hidden inputs for uploads */}
      <input 
        ref={imageInputRef} 
        type="file" 
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
        style={{ display: 'none' }} 
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { 
            await handleUpload(f, true); 
          } catch (err) { 
            alert((err as Error).message || 'Upload failed'); 
          }
          // Reset file input to allow re-uploading the same file
          if (e.currentTarget) {
            e.currentTarget.value = '';
          }
        }} 
      />
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".pdf,.txt,.md,.docx,.xlsx,.pptx,.csv"
        style={{ display: 'none' }} 
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { 
            await handleUpload(f, false); 
          } catch (err) { 
            alert((err as Error).message || 'Upload failed'); 
          }
          // Reset file input to allow re-uploading the same file
          if (e.currentTarget) {
            e.currentTarget.value = '';
          }
        }} 
      />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Mode Toggle (Radio-style) */}
        <div className={styles.toolbarGroup}>
          <button 
            type="button" 
            className={`${styles.toolButton} ${selectedTab === 'write' ? styles.active : ''}`}
            onClick={() => setSelectedTab('write')}
            title="Write"
          >
            Write
          </button>
          <button 
            type="button" 
            className={`${styles.toolButton} ${selectedTab === 'preview' ? styles.active : ''}`}
            onClick={() => setSelectedTab('preview')}
            title="Preview"
          >
            Preview
          </button>
        </div>

        {/* Formatting Buttons (only show in write mode) */}
        {selectedTab === 'write' && (
          <>
            <div className={styles.toolbarGroup}>
              <button type="button" className={styles.toolButton} title="Heading 1" onClick={() => insertAtCursor('\n# ')}>H1</button>
              <button type="button" className={styles.toolButton} title="Heading 2" onClick={() => insertAtCursor('\n## ')}>H2</button>
              <button type="button" className={styles.toolButton} title="Heading 3" onClick={() => insertAtCursor('\n### ')}>H3</button>
            </div>
            <div className={styles.toolbarGroup}>
              <button type="button" className={styles.toolButton} title="Bold" onClick={() => insertAtCursor('**bold**')}><strong>B</strong></button>
              <button type="button" className={styles.toolButton} title="Italic" onClick={() => insertAtCursor('_italic_')}><em>I</em></button>
              <button type="button" className={styles.toolButton} title="Underline" onClick={() => insertAtCursor('<u>underline</u>')}><u>U</u></button>
              <button type="button" className={styles.toolButton} title="Strikethrough" onClick={() => insertAtCursor('~~strike~~')}><s>S</s></button>
              <div style={{ position: 'relative' }}>
                <button 
                  type="button" 
                  className={styles.toolButton} 
                  title="Text Color" 
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  <span style={{color: selectedColor}}>A</span>
                </button>
                {showColorPicker && (
                  <div ref={colorPickerRef} className={styles.colorPicker}>
                    <div className={styles.colorGrid}>
                      {predefinedColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          className={styles.colorSwatch}
                          style={{ backgroundColor: color }}
                          onClick={() => applyColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                    <div className={styles.customColorRow}>
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className={styles.colorInput}
                      />
                      <button
                        type="button"
                        className={styles.applyColorButton}
                        onClick={() => applyColor(selectedColor)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.toolbarGroup}>
              <button type="button" className={styles.toolButton} title="Bullet List" onClick={() => insertAtCursor('\n* item')}>• List</button>
              <button type="button" className={styles.toolButton} title="Numbered List" onClick={() => insertAtCursor('\n1. item')}>1. List</button>
              <button type="button" className={styles.toolButton} title="Checkbox" onClick={() => insertAtCursor('\n- [ ] item')}>☑️</button>
            </div>
            <div className={styles.toolbarGroup}>
              <button type="button" className={styles.toolButton} title="Blockquote" onClick={() => insertAtCursor('\n> quote')}>❝</button>
              <button type="button" className={styles.toolButton} title="Code Block" onClick={() => insertAtCursor('\n```\ncode\n```')}>{'<>'}</button>
              <button type="button" className={styles.toolButton} title="Link" onClick={() => insertAtCursor('[link](url)')}>🔗</button>
            </div>
            <div className={styles.toolbarGroup}>
              <button type="button" className={styles.toolButton} title="Insert image" onClick={() => imageInputRef.current?.click()}>🖼️</button>
              <button type="button" className={styles.toolButton} title="Insert file link" onClick={() => fileInputRef.current?.click()}>📎</button>
            </div>
          </>
        )}

        {/* Save Button (always visible) */}
        <div className={styles.toolbarGroup} style={{ marginLeft: 'auto' }}>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className={styles.editorArea}>
        {selectedTab === 'write' ? (
          <textarea
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Write using Markdown… Drop or paste images/files to upload'}
          />
        ) : (
          <div
            className={styles.preview}
            // Ensure preview never renders <video>/<audio> tags
            dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(converterRef.current.makeHtml(value || '')) }}
          />
        )}
      </div>
      <div className={styles.hint}>Tip: drag & drop or paste images/files to upload to MinIO automatically.</div>
    </div>
  );
}
