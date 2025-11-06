/**
 * Tests for Faculties Search Page
 * 
 * Refactored to use shared test utilities and reduce duplication
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createMockRouter, createMockFetch, createMockUniversity, createMockFaculty, setupPageTest } from '../setup/testUtils';

// Mock Next.js and common dependencies
jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = createMockRouter({ 
  query: { id: '1' }, 
  pathname: '/university/[id]/faculties', 
  asPath: '/university/1/faculties' 
});

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

describe('Faculties Search Page', () => {
  beforeEach(() => {
    setupPageTest();
  });

  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('filters faculties by search text', async () => {
    // Setup mock data
    const university = createMockUniversity({ id: 1, name: 'Uni A', code: 'UA' });
    const faculties = [
      createMockFaculty({ id: 10, name: 'Science', short_name: 'SCI', code: 'SCI' }),
      createMockFaculty({ id: 11, name: 'Arts', short_name: 'ART', code: 'ART' }),
    ];

    // Setup mock fetch with test utils
    global.fetch = createMockFetch({
      '/api/v1/universities/': [university],
      '/api/v1/faculties/1': faculties,
    }) as any;

    // Render page
    const Page = require('../../pages/university/[id]/faculties').default;
    render(<Page />);

    // Wait for page to load
    await screen.findByText('Faculties - Uni A');
    
    // Type in search input
    const input = screen.getByLabelText('Search faculties');
    fireEvent.change(input, { target: { value: 'art' } });

    // Verify filtered results
    expect(await screen.findByText('Arts')).toBeInTheDocument();
    
    // Wait for debounced search to filter out non-matching items
    await waitFor(() => {
      expect(screen.queryByText('Science')).not.toBeInTheDocument();
    });
  });
});
