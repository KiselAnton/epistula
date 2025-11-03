import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { uploadToStorage } from '../../lib/api';
import styles from './MarkdownEditor.module.css';

// Import MDEditor dynamically to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface WysiwygMarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  placeholder?: string;
}

export default function WysiwygMarkdownEditor({ 
  value, 
  onChange, 
  onSave, 
  isSaving, 
  placeholder 
}: WysiwygMarkdownEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload and insert markdown
  const handleUpload = async (file: File, isImage: boolean): Promise<void> => {
    try {
      const res = await uploadToStorage(file);
      if (!res?.url) throw new Error('Upload failed: no URL returned');
      
      const markdownSyntax = isImage 
        ? `![${file.name}](${res.url})` 
        : `[📎 ${file.name}](${res.url})`;
      
      // Insert at the end for now (could be improved to insert at cursor)
      onChange(value + '\n\n' + markdownSyntax);
      
      console.log(`Inserted markdown: ${markdownSyntax}`);
    } catch (error) {
      console.error('Upload error:', error);
      alert((error as Error).message || 'Upload failed');
    }
  };

  // Handle paste events for file uploads
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const isImage = file.type.startsWith('image/');
        await handleUpload(file, isImage);
      }
    }
  };

  // Handle drop events for file uploads
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      await handleUpload(file, isImage);
    }
  };

  return (
    <div className={styles.editorContainer} onPaste={handlePaste} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      {/* Hidden file inputs */}
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
          if (e.currentTarget) {
            e.currentTarget.value = '';
          }
        }} 
      />

      {/* Custom toolbar with upload buttons */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button 
            type="button" 
            className={styles.toolButton} 
            title="Upload Image"
            onClick={() => imageInputRef.current?.click()}
          >
            🖼️ Image
          </button>
          <button 
            type="button" 
            className={styles.toolButton} 
            title="Upload File"
            onClick={() => fileInputRef.current?.click()}
          >
            📎 File
          </button>
        </div>
        
        <div className={styles.toolbarGroup} style={{ marginLeft: 'auto' }}>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* WYSIWYG Editor */}
      <div data-color-mode="light">
        <MDEditor
          value={value}
          onChange={(val) => onChange(val || '')}
          preview="live"
          height={400}
          visibleDragbar={false}
          hideToolbar={false}
          enableScroll={true}
          textareaProps={{
            placeholder: placeholder || 'Write using Markdown… Drop or paste images/files to upload'
          }}
        />
      </div>
      
      <div className={styles.hint}>
        💡 Tip: Drag & drop or paste images/files to upload automatically. Supports markdown formatting with live preview.
      </div>
    </div>
  );
}
