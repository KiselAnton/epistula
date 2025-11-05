import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

// Mock next/router BEFORE importing component
const mockPush = jest.fn();
const mockRouter = {
  query: { id: '1' },
  push: mockPush,
  prefetch: jest.fn(),
  asPath: '/university/1/my/notes',
  pathname: '/university/[id]/my/notes',
  isReady: true,
  route: '/university/[id]/my/notes',
  basePath: '',
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  isFallback: false,
  reload: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  beforePopState: jest.fn()
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter
}));

// Mock MainLayout to avoid sidebar/auth side effects in unit tests
jest.mock('../components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>
}));

// Mock getBackendUrl to return empty string for relative URLs in tests
jest.mock('../lib/config', () => ({
  getBackendUrl: jest.fn(() => '')
}));

// Import the page after mocks
import MyNotesPage from '../pages/university/[id]/my/notes';

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
  
  const store: Record<string, string> = { token: 'dummy.jwt.token' };
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: jest.fn((key: string) => { delete store[key]; }),
      clear: jest.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
    },
    writable: true
  });
});


afterEach(() => {
  jest.resetAllMocks();
});

test('My Notes page renders empty state', async () => {
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes('/universities/1/my/notes')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  render(<MyNotesPage />);

  await waitFor(() => {
    expect(screen.getByText(/You don't have any notes yet/i)).toBeInTheDocument();
  });
});

test('My Notes page renders sample data (markdown, media stripped)', async () => {
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
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
          content: 'Hello from note\n\n<video src="evil.mp4"></video> and <audio src="evil.mp3"></audio>',
          updated_at: new Date().toISOString()
        }
      ]) } as any);
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  render(<MyNotesPage />);

  // Wait for the lecture title to appear
  await waitFor(() => {
    expect(screen.getByText(/Sorting/i)).toBeInTheDocument();
  });
  
  // Ensure media tags are not rendered (sanitized)
  expect(document.body.querySelector('video')).toBeNull();
  expect(document.body.querySelector('audio')).toBeNull();
});

test('clicking on a note card navigates to the lecture', async () => {
  const user = userEvent.setup();
  
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
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
    return Promise.resolve({ ok: true, status: 200, json: async () => [] } as any);
  });

  render(<MyNotesPage />);

  // Wait for note card to appear
  await waitFor(() => {
    expect(screen.getByText(/Sorting Algorithms/i)).toBeInTheDocument();
  });
  
  const lectureTitle = screen.getByText(/Sorting Algorithms/i);
  
  // Click on the note card (find the clickable container)
  const noteCard = lectureTitle.closest('div[style*="cursor"]');
  expect(noteCard).toBeInTheDocument();
  
  await user.click(noteCard!);
  
  // Verify navigation was called with correct URL
  expect(mockPush).toHaveBeenCalledWith('/university/1/faculty/7/subject/3#lecture-10');
});


