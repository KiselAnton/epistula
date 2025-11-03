/**
 * Tests for WysiwygMarkdownEditor component with role-based block restrictions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WysiwygMarkdownEditor from '../WysiwygMarkdownEditor';

// Mock the BlockNote components
jest.mock('@blocknote/react', () => ({
  useCreateBlockNote: jest.fn((config) => ({
    document: [],
    tryParseMarkdownToBlocks: jest.fn().mockResolvedValue([]),
    replaceBlocks: jest.fn(),
    blocksToMarkdownLossy: jest.fn().mockResolvedValue('# Test markdown'),
    _config: config, // Store config for inspection in tests
  })),
}));

jest.mock('@blocknote/mantine', () => ({
  BlockNoteView: ({ editor, onChange }: any) => (
    <div data-testid="blocknote-view">
      <button
        data-testid="trigger-change"
        onClick={() => onChange && onChange()}
      >
        Trigger Change
      </button>
      {/* Expose blockSpecs for testing */}
      <div data-testid="block-specs">
        {JSON.stringify(Object.keys(editor._config?.blockSpecs || {}))}
      </div>
    </div>
  ),
}));

jest.mock('@blocknote/core', () => ({
  defaultBlockSpecs: {
    paragraph: {},
    heading: {},
    bulletListItem: {},
    numberedListItem: {},
    checkListItem: {},
    table: {},
    image: {},
    video: {},
    audio: {},
    file: {},
    codeBlock: {},
  },
}));

// Mock the API
jest.mock('../../../lib/api', () => ({
  uploadToStorage: jest.fn().mockResolvedValue({ url: '/storage/test.jpg' }),
}));

describe('WysiwygMarkdownEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role-based block restrictions', () => {
    it('should allow all blocks for root users', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="root"
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];
      const blockSpecs = config.blockSpecs;

      // Root users should have all blocks including video and audio
      expect(blockSpecs).toHaveProperty('paragraph');
      expect(blockSpecs).toHaveProperty('image');
      expect(blockSpecs).toHaveProperty('video');
      expect(blockSpecs).toHaveProperty('audio');
      expect(blockSpecs).toHaveProperty('file');
    });

    it('should allow all blocks for uni_admin users', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="uni_admin"
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];
      const blockSpecs = config.blockSpecs;

      // Uni admins should have all blocks including video and audio
      expect(blockSpecs).toHaveProperty('video');
      expect(blockSpecs).toHaveProperty('audio');
    });

    it('should allow all blocks for professor users', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="professor"
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];
      const blockSpecs = config.blockSpecs;

      // Professors should have all blocks including video and audio
      expect(blockSpecs).toHaveProperty('video');
      expect(blockSpecs).toHaveProperty('audio');
    });

    it('should restrict video and audio blocks for student users', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="student"
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];
      const blockSpecs = config.blockSpecs;

      // Students should NOT have video and audio blocks
      expect(blockSpecs).not.toHaveProperty('video');
      expect(blockSpecs).not.toHaveProperty('audio');

      // But should still have other blocks
      expect(blockSpecs).toHaveProperty('paragraph');
      expect(blockSpecs).toHaveProperty('image');
      expect(blockSpecs).toHaveProperty('file');
      expect(blockSpecs).toHaveProperty('heading');
    });

    it('should allow all blocks when no role is provided (default)', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];
      const blockSpecs = config.blockSpecs;

      // No role = default to all blocks (staff behavior)
      expect(blockSpecs).toHaveProperty('video');
      expect(blockSpecs).toHaveProperty('audio');
    });
  });

  describe('Component rendering', () => {
    it('should render the editor', () => {
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId('blocknote-view')).toBeInTheDocument();
    });

    it('should render save button', () => {
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should show saving state when isSaving is true', () => {
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      expect(screen.getByText('Saving…')).toBeInTheDocument();
    });

    it('should display hint text', () => {
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/Tip.*for commands/i)).toBeInTheDocument();
    });
  });

  describe('Save functionality', () => {
    it('should call onSave when save button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('should disable save button when isSaving is true', () => {
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          isSaving={true}
        />
      );

      const saveButton = screen.getByText('Saving…');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Content changes', () => {
    it('should call onChange when content changes', async () => {
      const user = userEvent.setup();

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const triggerButton = screen.getByTestId('trigger-change');
      await user.click(triggerButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });
  });

  describe('File upload configuration', () => {
    it('should configure file upload handler', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const config = useCreateBlockNote.mock.calls[0][0];

      expect(config).toHaveProperty('uploadFile');
      expect(typeof config.uploadFile).toBe('function');
    });
  });

  describe('Block spec counts', () => {
    it('should have fewer blocks for students than staff', () => {
      const { useCreateBlockNote } = require('@blocknote/react');

      // Render for student
      const { unmount } = render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="student"
        />
      );

      const studentConfig = useCreateBlockNote.mock.calls[useCreateBlockNote.mock.calls.length - 1][0];
      const studentBlockCount = Object.keys(studentConfig.blockSpecs).length;

      unmount();

      // Render for professor
      render(
        <WysiwygMarkdownEditor
          value=""
          onChange={mockOnChange}
          onSave={mockOnSave}
          userRole="professor"
        />
      );

      const professorConfig = useCreateBlockNote.mock.calls[useCreateBlockNote.mock.calls.length - 1][0];
      const professorBlockCount = Object.keys(professorConfig.blockSpecs).length;

      // Professor should have 2 more blocks (video + audio)
      expect(professorBlockCount).toBe(studentBlockCount + 2);
    });
  });
});
