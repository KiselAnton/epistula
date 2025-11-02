/**
 * API utility functions for making authenticated requests to the backend
 */

const BACKEND_URL = 'http://localhost:8000';

export const getBackendUrl = () => BACKEND_URL;

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

/**
 * Clear authentication and redirect to login
 */
export const clearAuthAndRedirect = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
};

/**
 * Generic API request handler with authentication
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  if (!token) {
    clearAuthAndRedirect();
    throw new Error('No authentication token');
  }

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthAndRedirect();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

/**
 * Upload file with multipart/form-data
 */
export async function uploadFile<T>(
  endpoint: string,
  file: File
): Promise<T> {
  const token = getAuthToken();
  
  if (!token) {
    clearAuthAndRedirect();
    throw new Error('No authentication token');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (response.status === 401) {
    clearAuthAndRedirect();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Upload failed');
  }

  return response.json();
}
