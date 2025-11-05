import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as nextRouter from 'next/router';
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

// Mock MainLayout to avoid sidebar/auth side effects in unit tests
jest.mock('../components/layout/MainLayout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));

// Mock getBackendUrl to return empty string for relative URLs in tests
jest.mock('../lib/config', () => ({
  getBackendUrl: jest.fn(() => '')
}));

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
  const push = jest.fn();
  const router = {
    query,
    push,
    prefetch: jest.fn(),
    asPath: `/university/${query.id}/my/notes`,
    pathname: '/university/[id]/my/notes',
    isReady: true
  };
  (nextRouter.useRouter as jest.Mock).mockReturnValue(router as any);
  return { push };
}

test('My Notes page renders empty state', async () => {
  mockRouter({ id: '1' });
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
    }
    if (url.includes('/universities/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([{ id: 1, name: 'University 1', code: 'U1' }]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  await act(async () => {
    render(<MyNotesPage />);
  });

  expect((await screen.findAllByText(/My Notes/i)).length).toBeGreaterThanOrEqual(1);
  expect(await screen.findByText(/You don't have any notes yet/i)).toBeInTheDocument();
});

test('My Notes page renders sample data (markdown, media stripped)', async () => {
  mockRouter({ id: '1' });
  
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([
        {
          id: 1,
          lecture_id: 10,
          subject_id: 3,
          faculty_id: 7,
          title: 'Sorting',
          subject_name: 'Algorithms',
          subject_code: 'ALG',
          // Include banned tags in content to ensure rendering strips them
          content: 'Hello from note\n\n<video src="evil.mp4"></video> and <audio src="evil.mp3"></audio>',
          updated_at: new Date().toISOString()
        }
      ]) } as any);
    }
    if (url.includes('/universities/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([{ id: 1, name: 'University 1', code: 'U1' }]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  await act(async () => {
    render(<MyNotesPage />);
  });

  // Wait for the lecture title to appear (proves fetch succeeded and data rendered)
  const lectureTitle = await screen.findByText(/Sorting/i, {}, { timeout: 3000 });
  expect(lectureTitle).toBeInTheDocument();
  
  // Ensure media tags are not rendered (sanitized)
  const container = document.body;
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('audio')).toBeNull();
});

test('clicking on a note card navigates to the lecture', async () => {
  const { push } = mockRouter({ id: '1' });
  const user = userEvent.setup();
  
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([
        {
          id: 1,
          lecture_id: 10,
          subject_id: 3,
          faculty_id: 7,
          title: 'Sorting Algorithms',
          subject_name: 'Algorithms',
          subject_code: 'ALG',
          content: 'My notes on sorting',
          updated_at: new Date().toISOString()
        }
      ]) } as any);
    }
    if (url.includes('/universities/')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ([{ id: 1, name: 'University 1', code: 'U1' }]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  await act(async () => {
    render(<MyNotesPage />);
  });

  // Wait for note card to appear
  const lectureTitle = await screen.findByText(/Sorting Algorithms/i);
  expect(lectureTitle).toBeInTheDocument();
  
  // Click on the note card (find the clickable container)
  const noteCard = lectureTitle.closest('div[style*="cursor"]');
  expect(noteCard).toBeInTheDocument();
  
  await user.click(noteCard!);
  
  // Verify navigation was called with correct URL
  expect(push).toHaveBeenCalledWith('/university/1/faculty/7/subject/3#lecture-10');
});


