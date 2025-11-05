import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LectureNoteEditor from '../components/subject/LectureNoteEditor';

// Mock the BlockNotes-based editor to a simple input that calls onChange
jest.mock('../components/common/WysiwygMarkdownEditor', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      data-testid="mock-wysiwyg-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}));

// Helpers
function mockFetchOnce(status: number, body: any) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as any);
}

beforeEach(() => {
  (global.fetch as any) = jest.fn();
  const store: Record<string, string> = { token: 'dummy.jwt.token' };
  (global as any).localStorage = {
    getItem: jest.fn((key: string) => (store as any)[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { (store as any)[key] = value; }),
    removeItem: jest.fn((key: string) => { delete (store as any)[key]; }),
    clear: jest.fn(() => { for (const k of Object.keys(store)) delete (store as any)[k]; }),
  };
  (window as any).localStorage = (global as any).localStorage;
});

afterEach(() => {
  jest.resetAllMocks();
});

test('LectureNoteEditor loads 404 and shows empty state', async () => {
  // GET -> 404
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 } as any);

  render(
    <LectureNoteEditor universityId="1" facultyId="2" subjectId="3" lectureId={10} tokenOverride="test-token" />
  );

  // Initially closed
  expect(screen.queryByRole('button', { name: /save note/i })).not.toBeInTheDocument();

  // Open editor
  fireEvent.click(screen.getByRole('button', { name: /my note/i }));

  // Wait for open state and empty content
  await screen.findByText(/No note yet\. Create one below\./i);
  const input = await screen.findByTestId('mock-wysiwyg-input');
  expect((input as HTMLInputElement).value).toBe('');
});

test('LectureNoteEditor saves successfully (sanitizes media tags)', async () => {
  // First opening: GET -> 404 (no note)
  mockFetchOnce(404, {});
  // Save: POST -> 200 with updated_at and assert body sanitized
  ;(global.fetch as jest.Mock).mockImplementationOnce(async (_url: string, init?: any) => {
    try {
      const body = JSON.parse(init?.body || '{}');
      expect(String(body.content || '')).not.toMatch(/<\s*(video|audio)/i);
    } catch {}
    return {
      ok: true,
      status: 200,
      json: async () => ({ updated_at: new Date().toISOString() }),
      text: async () => ''
    } as any;
  });

  render(
    <LectureNoteEditor universityId="1" facultyId="2" subjectId="3" lectureId={11} tokenOverride="test-token" />
  );

  fireEvent.click(screen.getByRole('button', { name: /my note/i }));
  const input = await screen.findByTestId('mock-wysiwyg-input');
  fireEvent.change(input, { target: { value: 'Hello note <video src="x.mp4"></video>' } });

  fireEvent.click(screen.getByRole('button', { name: /save note/i }));

  await waitFor(() => expect(screen.getByText(/Saved at/i)).toBeInTheDocument());
  // Ensure POST was called
  expect((global.fetch as jest.Mock)).toHaveBeenCalledWith(expect.stringMatching(/\/lectures\/11\/notes$/), expect.objectContaining({ method: 'POST' }));
});
