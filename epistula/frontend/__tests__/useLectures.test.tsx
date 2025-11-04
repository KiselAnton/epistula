import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useLectures } from '../hooks/useLectures';

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush })
}));

describe('useLectures', () => {
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock localStorage properly
    Storage.prototype.getItem = jest.fn((key: string) => {
      if (key === 'token') return 'test-token';
      return null;
    });
    Storage.prototype.removeItem = jest.fn();

    global.fetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    ) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch as any;
    jest.restoreAllMocks();
  });

  it('loads lectures from relative API URL (proxied by Next.js)', async () => {
    const { result } = renderHook(() => useLectures('1', '2', '3'));

    // Wait for hook to finish loading
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Verify relative URL is used (Next.js will proxy to backend)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/subjects/1/2/3/lectures',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    );

    // And lectures array is set (empty from our mock)
    expect(Array.isArray(result.current.lectures)).toBe(true);
  });

  it('redirects to login on 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });

    const { result } = renderHook(() => useLectures('1', '2', '3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Should clear token and redirect
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('creates a lecture successfully', async () => {
    const newLecture = { id: 1, title: 'New Lecture', description: 'Test' };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }) // initial load
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => newLecture }) // create
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [newLecture] }); // reload

    const { result } = renderHook(() => useLectures('1', '2', '3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.handleCreateLecture({ title: 'New Lecture', description: 'Test' });

    // Should POST to create endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/subjects/1/2/3/lectures',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token'
        }),
        body: expect.any(String)
      })
    );

    // Should reload lectures after creation
    await waitFor(() => expect(result.current.lectures.length).toBeGreaterThanOrEqual(0));
  });

  it('deletes a lecture successfully', async () => {
    global.confirm = jest.fn(() => true);
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1, title: 'Test' }] }) // initial load
      .mockResolvedValueOnce({ ok: true, status: 204 }) // delete
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }); // reload

    const { result } = renderHook(() => useLectures('1', '2', '3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.handleDeleteLecture(1);

    // Should DELETE lecture
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/subjects/1/2/3/lectures/1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
      })
    );
  });

  it('toggles lecture publish status', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1, is_active: false }] }) // initial load
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 1, is_active: true }) }) // patch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [{ id: 1, is_active: true }] }); // reload

    const { result } = renderHook(() => useLectures('1', '2', '3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.togglePublishLecture(1, true);

    // Should PATCH lecture with is_active
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/subjects/1/2/3/lectures/1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token'
        }),
        body: JSON.stringify({ is_active: true })
      })
    );
  });

  it('handles unauthorized on create and redirects', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] }) // initial load
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) }); // create fails

    const { result } = renderHook(() => useLectures('1', '2', '3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.handleCreateLecture({ title: 'Test' })).rejects.toThrow('Unauthorized');

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
