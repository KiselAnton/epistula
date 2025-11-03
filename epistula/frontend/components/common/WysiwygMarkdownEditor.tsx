import { useEffect, useMemo } from 'react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/react/style.css';
import { BlockNoteView } from '@blocknote/react';
import { useCreateBlockNote } from '@blocknote/react';
import { uploadToStorage } from '../../lib/api';
import styles from './MarkdownEditor.module.css';

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
  
  // Handle file uploads for BlockNote
  const handleUpload = async (file: File): Promise<string> => {
    try {
      const res = await uploadToStorage(file);
      if (!res?.url) throw new Error('Upload failed: no URL returned');
      return res.url;
    } catch (error) {
      console.error('Upload error:', error);
      alert((error as Error).message || 'Upload failed');
      throw error;
    }
  };

  // Create BlockNote editor instance
  const editor = useCreateBlockNote({
    initialContent: value ? undefined : undefined, // Will parse markdown below
    uploadFile: handleUpload,
  });

  // Load initial markdown content
  useEffect(() => {
    if (value && editor) {
      const loadContent = async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(value);
          editor.replaceBlocks(editor.document, blocks);
        } catch (e) {
          console.error('Error parsing markdown:', e);
        }
      };
      loadContent();
    }
  }, []); // Only on mount

  // Handle content changes - convert blocks to markdown
  const handleChange = async () => {
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    onChange(markdown);
  };

  return (
    <div className={styles.editorContainer}>
      {/* Save button at the top */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup} style={{ marginLeft: 'auto' }}>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* BlockNote Editor - True Notion-style WYSIWYG */}
      <BlockNoteView 
        editor={editor} 
        onChange={handleChange}
        theme="light"
        data-theming-css-variables-demo
      />
      
      <div className={styles.hint}>
        💡 Tip: Type <code>/</code> for commands, drag blocks to reorder, paste images directly. Full Notion-style editing!
      </div>
    </div>
  );
}
