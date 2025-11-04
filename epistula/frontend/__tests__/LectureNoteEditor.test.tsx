import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LectureNoteEditor from '../components/subject/LectureNoteEditor';

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
  expect(screen.queryByPlaceholderText(/Write your private note/i)).not.toBeInTheDocument();

  // Open editor
  fireEvent.click(screen.getByRole('button', { name: /my note/i }));

  // Wait for textarea to appear and be empty
  const textarea = screen.getByPlaceholderText(/Write your private note/i) as HTMLTextAreaElement;
  await waitFor(() => expect(textarea.value).toBe(''));
  expect(textarea.value).toBe('');
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
  await screen.findByPlaceholderText(/Write your private note/i);
  fireEvent.change(screen.getByPlaceholderText(/Write your private note/i), { target: { value: 'Hello note <video src="x.mp4"></video>' } });

  fireEvent.click(screen.getByRole('button', { name: /save note/i }));

  await waitFor(() => expect(screen.getByText(/Saved at/i)).toBeInTheDocument());
  // Ensure POST was called
  expect((global.fetch as jest.Mock)).toHaveBeenCalledWith(expect.stringMatching(/\/lectures\/11\/notes$/), expect.objectContaining({ method: 'POST' }));
});
