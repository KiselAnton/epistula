/**
 * Shared test utilities and mock factories
 * 
 * This file centralizes common test setup code to:
 * - Reduce duplication across test files
 * - Ensure consistent mocking patterns
 * - Speed up test execution by reusing helpers
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// ============================================================================
// Common Mock Factories
// ============================================================================

/**
 * Creates a mock Next.js router with sensible defaults
 */
export const createMockRouter = (overrides = {}) => ({
  push: jest.fn(),
  replace: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  back: jest.fn(),
  forward: jest.fn(),
  reload: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
  beforePopState: jest.fn(),
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  ...overrides,
});

/**
 * Creates a mock fetch response
 */
export const createMockFetchResponse = <T,>(data: T, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  headers: new Headers(),
  redirected: false,
  statusText: ok ? 'OK' : 'Error',
  type: 'basic' as ResponseType,
  url: '',
  clone: jest.fn(),
  body: null,
  bodyUsed: false,
  arrayBuffer: async () => new ArrayBuffer(0),
  blob: async () => new Blob(),
  formData: async () => new FormData(),
});

/**
 * Creates a mock fetch implementation that routes based on URL patterns
 */
export const createMockFetch = (routes: Record<string, any>) => {
  return jest.fn((url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.url;
    
    for (const [pattern, response] of Object.entries(routes)) {
      if (urlStr.includes(pattern)) {
        if (typeof response === 'function') {
          return Promise.resolve(response(urlStr, init));
        }
        return Promise.resolve(createMockFetchResponse(response));
      }
    }
    
    // Default 404 response
    return Promise.resolve(createMockFetchResponse({ detail: 'Not found' }, false, 404));
  });
};

/**
 * Creates a mock localStorage implementation
 */
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; },
  };
};

/**
 * Setup localStorage mock for a test
 */
export const setupLocalStorage = () => {
  const mockStorage = createMockLocalStorage();
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  return mockStorage;
};

// ============================================================================
// Common Test Data Factories
// ============================================================================

export const createMockUser = (overrides = {}) => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'professor',
  primary_university_id: 1,
  is_active: true,
  university_access: [
    {
      university_id: 1,
      university_name: 'Test University',
      university_code: 'TEST',
      role: 'professor',
      is_active: true,
    },
  ],
  ...overrides,
});

export const createMockUniversity = (overrides = {}) => ({
  id: 1,
  name: 'Test University',
  short_name: 'TU',
  code: 'TEST',
  description: 'Test description',
  logo_url: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

export const createMockFaculty = (overrides = {}) => ({
  id: 10,
  university_id: 1,
  name: 'Science',
  short_name: 'SCI',
  code: 'SCI',
  description: 'Faculty of Science',
  logo_url: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSubject = (overrides = {}) => ({
  id: 20,
  faculty_id: 10,
  university_id: 1,
  name: 'Mathematics',
  code: 'MATH101',
  description: 'Introduction to Mathematics',
  logo_url: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

export const createMockLecture = (overrides = {}) => ({
  id: 30,
  subject_id: 20,
  title: 'Lecture 1',
  description: 'First lecture',
  content: '# Lecture content',
  order_index: 1,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// ============================================================================
// Common Setup Functions
// ============================================================================

/**
 * Standard setup for page tests that need router and fetch
 */
export const setupPageTest = () => {
  const mockRouter = createMockRouter();
  const mockStorage = setupLocalStorage();
  
  // Set default auth state
  mockStorage.setItem('token', 'test-token');
  mockStorage.setItem('user', JSON.stringify(createMockUser()));
  
  return {
    mockRouter,
    mockStorage,
  };
};

/**
 * Setup for tests that need authenticated API calls
 */
export const setupAuthenticatedTest = (userData = {}) => {
  const user = createMockUser(userData);
  const mockStorage = setupLocalStorage();
  
  mockStorage.setItem('token', 'test-token');
  mockStorage.setItem('user', JSON.stringify(user));
  
  return {
    user,
    token: 'test-token',
    mockStorage,
  };
};

/**
 * Wait for async updates (alternative to act() when needed)
 */
export const waitForNextUpdate = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// ============================================================================
// Custom Render Helpers
// ============================================================================

/**
 * Custom render that wraps with common providers if needed
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => {
  return render(ui, options);
};

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that fetch was called with specific endpoint
 */
export const expectFetchCalled = (url: string, options?: Partial<RequestInit>) => {
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining(url),
    options ? expect.objectContaining(options) : expect.anything()
  );
};

/**
 * Assert that router navigated to path
 */
export const expectNavigatedTo = (mockRouter: any, path: string) => {
  expect(mockRouter.push).toHaveBeenCalledWith(
    expect.stringContaining(path)
  );
};

// ============================================================================
// Mock Module Helpers
// ============================================================================

/**
 * Common mocks for Next.js modules
 */
export const commonNextMocks = {
  router: {
    path: 'next/router',
    mock: () => ({
      useRouter: jest.fn(),
    }),
  },
  image: {
    path: 'next/image',
    mock: () => ({
      __esModule: true,
      default: function MockImage(props: any) {
        /* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
        return Object.assign(document.createElement('img'), props);
      },
    }),
  },
  config: {
    path: '../../lib/config',
    mock: () => ({
      getBackendUrl: () => 'http://localhost:8000',
    }),
  },
  wysiwygEditor: {
    path: '../../components/common/WysiwygMarkdownEditor',
    mock: () => ({
      __esModule: true,
      default: () => null,
    }),
  },
};

/**
 * Apply common mocks for page tests
 */
export const applyCommonMocks = () => {
  jest.mock('next/router', commonNextMocks.router.mock);
  jest.mock('../../lib/config', commonNextMocks.config.mock);
  jest.mock('../../components/common/WysiwygMarkdownEditor', commonNextMocks.wysiwygEditor.mock);
};
