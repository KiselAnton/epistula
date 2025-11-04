import { render, screen, waitFor } from '@testing-library/react';
import * as nextRouter from 'next/router';
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

// Mock MainLayout to avoid sidebar/auth side effects in unit tests
jest.mock('../components/layout/MainLayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));

// Import the page after mocks
const MyNotesPage = require('../pages/university/[id]/my/notes').default;

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

afterEach(() => jest.resetAllMocks());

function mockRouter(query: any) {
  (nextRouter.useRouter as jest.Mock).mockReturnValue({
    query,
    push: jest.fn(),
    prefetch: jest.fn(),
    asPath: `/university/${query.id}/my/notes`,
    pathname: '/university/[id]/my/notes'
  } as any);
}

test('My Notes page renders empty state', async () => {
  mockRouter({ id: '1' });
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/v1/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
    }
    if (url.includes('/api/v1/universities/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([{ id: 1, name: 'University 1', code: 'U1' }]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  render(<MyNotesPage />);

  expect((await screen.findAllByText(/My Notes/i)).length).toBeGreaterThanOrEqual(1);
  expect(await screen.findByText(/You don't have any notes yet/i)).toBeInTheDocument();
});

test('My Notes page renders sample data (markdown, media stripped)', async () => {
  mockRouter({ id: '1' });
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/v1/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([
        {
          lecture_id: 10,
          subject_id: 3,
          subject_name: 'Algorithms',
          subject_code: 'ALG',
          lecture_title: 'Sorting',
          // Include banned tags in content to ensure rendering strips them
          content: 'Hello from note\n\n<video src="evil.mp4"></video> and <audio src="evil.mp3"></audio>',
          updated_at: new Date().toISOString()
        }
      ]) } as any);
    }
    if (url.includes('/api/v1/universities/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([{ id: 1, name: 'University 1', code: 'U1' }]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  render(<MyNotesPage />);

  // Verify the notes endpoint was requested
  await waitFor(() => {
    expect((global.fetch as jest.Mock)).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/universities\/1\/my\/notes/), expect.any(Object));
  });

  // Ensure media tags are not rendered
  const container = document.body;
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('audio')).toBeNull();
  // And the page header is present (basic rendering)
  expect((await screen.findAllByText(/My Notes/i)).length).toBeGreaterThanOrEqual(1);
});
