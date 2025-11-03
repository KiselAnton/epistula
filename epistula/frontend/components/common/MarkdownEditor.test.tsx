import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkdownEditor from './MarkdownEditor';
import * as api from '../../lib/api';

// Mock the API
jest.mock('../../lib/api', () => ({
  uploadToStorage: jest.fn(),
}));

describe('MarkdownEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default write mode', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByTitle('Write')).toHaveClass('active');
    expect(screen.getByPlaceholderText(/Write using Markdown/i)).toBeInTheDocument();
  });

  it('toggles between write and preview modes', () => {
    render(
      <MarkdownEditor
        value="# Hello World"
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    const writeButton = screen.getByTitle('Write');
    const previewButton = screen.getByTitle('Preview');

    expect(writeButton).toHaveClass('active');
    expect(previewButton).not.toHaveClass('active');

    // Switch to preview
    fireEvent.click(previewButton);
    expect(previewButton).toHaveClass('active');
    expect(writeButton).not.toHaveClass('active');

    // Switch back to write
    fireEvent.click(writeButton);
    expect(writeButton).toHaveClass('active');
    expect(previewButton).not.toHaveClass('active');
  });

  it('shows all formatting buttons in write mode', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 3')).toBeInTheDocument();
    expect(screen.getByTitle('Bold')).toBeInTheDocument();
    expect(screen.getByTitle('Italic')).toBeInTheDocument();
    expect(screen.getByTitle('Underline')).toBeInTheDocument();
    expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();
    expect(screen.getByTitle('Text Color')).toBeInTheDocument();
    expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
    expect(screen.getByTitle('Numbered List')).toBeInTheDocument();
    expect(screen.getByTitle('Checkbox')).toBeInTheDocument();
    expect(screen.getByTitle('Blockquote')).toBeInTheDocument();
    expect(screen.getByTitle('Code Block')).toBeInTheDocument();
    expect(screen.getByTitle('Link')).toBeInTheDocument();
    expect(screen.getByTitle('Insert image')).toBeInTheDocument();
    expect(screen.getByTitle('Insert file link')).toBeInTheDocument();
  });

  it('hides formatting buttons in preview mode', () => {
    render(
      <MarkdownEditor
        value="# Test"
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle('Preview'));

    expect(screen.queryByTitle('Heading 1')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Italic')).not.toBeInTheDocument();
  });

  it('always shows Save button in both modes', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Save')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Preview'));
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('inserts markdown when formatting buttons are clicked', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle('Bold'));
    expect(mockOnChange).toHaveBeenCalledWith('**bold**');

    mockOnChange.mockClear();
    fireEvent.click(screen.getByTitle('Italic'));
    expect(mockOnChange).toHaveBeenCalledWith('_italic_');

    mockOnChange.mockClear();
    fireEvent.click(screen.getByTitle('Heading 1'));
    expect(mockOnChange).toHaveBeenCalledWith('\n# ');
  });

  it('shows color picker when color button is clicked', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    const colorButton = screen.getByTitle('Text Color');
    fireEvent.click(colorButton);

    // Color picker should be visible
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('applies selected color from predefined swatches', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    // Open color picker
    fireEvent.click(screen.getByTitle('Text Color'));

    // Click a color swatch (first one, which is #e53e3e)
    const swatches = document.querySelectorAll('[title^="#"]');
    fireEvent.click(swatches[0]);

    expect(mockOnChange).toHaveBeenCalledWith("<span style='color:#e53e3e'>text</span>");
  });

  it('calls onSave when Save button is clicked', () => {
    render(
      <MarkdownEditor
        value="test"
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText('Save'));
    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('disables Save button when isSaving is true', () => {
    render(
      <MarkdownEditor
        value="test"
        onChange={mockOnChange}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    const saveButton = screen.getByText('Saving…');
    expect(saveButton).toBeDisabled();
  });

  it('updates value when typing in textarea', async () => {
    const user = userEvent.setup();
    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    const textarea = screen.getByPlaceholderText(/Write using Markdown/i);
    await user.type(textarea, 'Hello');

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('renders preview with markdown converted to HTML', () => {
    render(
      <MarkdownEditor
        value="# Hello\n**Bold text**"
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByTitle('Preview'));

    const preview = screen.getByText(/Hello/);
    expect(preview).toBeInTheDocument();
  });

  it('handles image upload', async () => {
    const mockUploadResponse = { url: 'https://example.com/image.png' };
    (api.uploadToStorage as jest.Mock).mockResolvedValue(mockUploadResponse);

    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    // Simulate clicking the image button
    const imageButton = screen.getByTitle('Insert image');
    fireEvent.click(imageButton);

    // Find the hidden file input and simulate file selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(api.uploadToStorage).toHaveBeenCalledWith(file);
      expect(mockOnChange).toHaveBeenCalledWith('![test.png](https://example.com/image.png)');
    });
  });

  it('handles file upload for non-images', async () => {
    const mockUploadResponse = { url: 'https://example.com/document.pdf' };
    (api.uploadToStorage as jest.Mock).mockResolvedValue(mockUploadResponse);

    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    // Simulate clicking the file button
    const fileButton = screen.getByTitle('Insert file link');
    fireEvent.click(fileButton);

    // Find the hidden file input and simulate file selection
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const fileInput = fileInputs[1] as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(api.uploadToStorage).toHaveBeenCalledWith(file);
      expect(mockOnChange).toHaveBeenCalledWith('[test.pdf](https://example.com/document.pdf)');
    });
  });

  it('shows error alert when upload fails', async () => {
    (api.uploadToStorage as jest.Mock).mockRejectedValue(new Error('Upload failed'));
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <MarkdownEditor
        value=""
        onChange={mockOnChange}
        onSave={mockOnSave}
      />
    );

    const imageButton = screen.getByTitle('Insert image');
    fireEvent.click(imageButton);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'test.png', { type: 'image/png' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Upload failed');
    });

    alertSpy.mockRestore();
  });
});
