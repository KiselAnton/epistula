import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: '1' }, push: jest.fn(), pathname: '/university/[id]', asPath: '/university/1' }),
}));
// Mock heavy WYSIWYG editor to avoid ESM parsing issues from prosemirror in Jest
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

// Mock config
jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));

// Helper to mock fetch responses in sequence
function mockFetchSequence(map: Record<string, any>) {
  global.fetch = jest.fn(async (url: string) => {
    const entry = Object.entries(map).find(([pattern]) => new RegExp(pattern).test(url));
    if (!entry) {
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }
    const [, value] = entry;
    return { ok: true, status: 200, json: async () => value } as any;
  }) as any;
}

describe('UniversityPage layout', () => {
  beforeEach(() => {
    // Token and user as root
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ role: 'root', universities: [1] }));
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('renders backups section after faculties and action buttons', async () => {
    mockFetchSequence({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/backups/1': { backups: [] },
    });

    const Page = require('../../pages/university/[id]').default;
    render(<Page />);

    // Wait for faculties to render
    await screen.findByRole('heading', { name: /Faculties/i });

    // Identify sections by representative buttons/texts
    const manageFacultiesBtn = await screen.findByRole('button', { name: /Manage Faculties/i });

    // Backups section exposes a "Backup Now" button when expanded; default is collapsed,
    // but the action button is still in the header. Assert its presence in the document.
    const backupNowBtn = await screen.findByRole('button', { name: /Backup Now/i });

    // Compare DOM order: backups button should appear after the manage faculties button
    const orderIsCorrect = manageFacultiesBtn.compareDocumentPosition(backupNowBtn) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(orderIsCorrect).toBeTruthy();
  });
});
