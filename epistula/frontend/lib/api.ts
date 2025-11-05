/**
 * API utility with caching and prefetching support
 * Provides centralized API calls with automatic caching and performance optimizations
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

// Global cache instance
const cache = new APICache();

// Prefetch queue for background data loading
const prefetchQueue = new Set<string>();
let prefetchTimer: NodeJS.Timeout | null = null;

/**
 * Get backend URL
 */
function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
}

/**
 * Get authorization token from localStorage
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

/**
 * Create cache key from URL and options
 */
function createCacheKey(url: string, options?: RequestInit): string {
  const method = options?.method || 'GET';
  const body = options?.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
}

interface FetchOptions extends RequestInit {
  skipCache?: boolean;
  cacheTTL?: number;
  token?: string | null;
}

/**
 * Enhanced fetch with caching support
 */
export async function cachedFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${getBackendUrl()}${endpoint}`;
  
  const { skipCache = false, cacheTTL, token, ...fetchOptions } = options;
  const method = fetchOptions.method || 'GET';
  
  // Only cache GET requests
  const shouldCache = method === 'GET' && !skipCache;
  const cacheKey = createCacheKey(url, fetchOptions);

  // Check cache first
  if (shouldCache && cache.has(cacheKey)) {
    const cached = cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Add authorization header
  const authToken = token !== undefined ? token : getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Make the request
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const data = await response.json();

  // Cache successful GET requests
  if (shouldCache) {
    cache.set(cacheKey, data, cacheTTL);
  }

  return data;
}

/**
 * Prefetch data in the background
 */
export function prefetch(endpoint: string, options: FetchOptions = {}): void {
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${getBackendUrl()}${endpoint}`;
  
  const cacheKey = createCacheKey(url, options);

  // Skip if already cached or in queue
  if (cache.has(cacheKey) || prefetchQueue.has(cacheKey)) {
    return;
  }

  prefetchQueue.add(cacheKey);

  // Debounce prefetch execution
  if (prefetchTimer) {
    clearTimeout(prefetchTimer);
  }

  prefetchTimer = setTimeout(() => {
    prefetchQueue.forEach(() => {
      cachedFetch(endpoint, options).catch(() => {
        // Silently fail prefetch attempts
      });
    });
    prefetchQueue.clear();
  }, 100);
}

/**
 * Invalidate cache entries
 */
export function invalidateCache(pattern?: string): void {
  cache.invalidate(pattern);
}

/**
 * API endpoints with optimized caching
 */
export const api = {
  // Universities
  getUniversities: () => 
    cachedFetch<{ universities: any[] }>('/api/v1/universities', { cacheTTL: 10 * 60 * 1000 }), // 10 min
  
  getUniversity: (id: string | number) => 
    cachedFetch<any>(`/api/v1/universities/${id}`, { cacheTTL: 10 * 60 * 1000 }),
  
  createUniversity: (data: any) => 
    cachedFetch<any>('/api/v1/universities', {
      method: 'POST',
      body: JSON.stringify(data),
      skipCache: true,
    }),
  
  updateUniversity: (id: string | number, data: any) => 
    cachedFetch<any>(`/api/v1/universities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      skipCache: true,
    }),
  
  // Faculties
  getFaculties: (universityId: string | number) => 
    cachedFetch<{ faculties: any[] }>(`/api/v1/universities/${universityId}/faculties`, { cacheTTL: 5 * 60 * 1000 }),
  
  getFaculty: (universityId: string | number, facultyId: string | number) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/faculties/${facultyId}`, { cacheTTL: 5 * 60 * 1000 }),
  
  createFaculty: (universityId: string | number, data: any) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/faculties`, {
      method: 'POST',
      body: JSON.stringify(data),
      skipCache: true,
    }),
  
  // Users
  getUsers: (universityId: string | number, role?: string) => {
    const endpoint = role 
      ? `/api/v1/universities/${universityId}/users?role=${role}`
      : `/api/v1/universities/${universityId}/users`;
    return cachedFetch<{ users: any[] }>(endpoint, { cacheTTL: 2 * 60 * 1000 }); // 2 min for user data
  },
  
  getUser: (universityId: string | number, userId: string | number) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/users/${userId}`, { cacheTTL: 2 * 60 * 1000 }),
  
  createUser: (universityId: string | number, data: any) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
      skipCache: true,
    }),
  
  updateUser: (universityId: string | number, userId: string | number, data: any) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      skipCache: true,
    }),
  
  deleteUser: (universityId: string | number, userId: string | number) => 
    cachedFetch<any>(`/api/v1/universities/${universityId}/users/${userId}`, {
      method: 'DELETE',
      skipCache: true,
    }),

  // Subjects
  getSubjects: (universityId: string | number, facultyId?: string | number) => {
    const endpoint = facultyId
      ? `/api/v1/universities/${universityId}/subjects?faculty_id=${facultyId}`
      : `/api/v1/universities/${universityId}/subjects`;
    return cachedFetch<{ subjects: any[] }>(endpoint, { cacheTTL: 5 * 60 * 1000 });
  },

  getSubject: (universityId: string | number, subjectId: string | number) =>
    cachedFetch<any>(`/api/v1/universities/${universityId}/subjects/${subjectId}`, { cacheTTL: 5 * 60 * 1000 }),
};

/**
 * Prefetch common data patterns
 */
export const prefetchPatterns = {
  // Prefetch university data when user logs in
  universityDashboard: (universityId: string | number) => {
    prefetch(`/api/v1/universities/${universityId}`);
    prefetch(`/api/v1/universities/${universityId}/faculties`);
    prefetch(`/api/v1/universities/${universityId}/users`);
  },

  // Prefetch faculty details
  facultyDetails: (universityId: string | number, facultyId: string | number) => {
    prefetch(`/api/v1/universities/${universityId}/faculties/${facultyId}`);
    prefetch(`/api/v1/universities/${universityId}/subjects?faculty_id=${facultyId}`);
  },

  // Prefetch user details
  userDetails: (universityId: string | number, userId: string | number) => {
    prefetch(`/api/v1/universities/${universityId}/users/${userId}`);
  },
};

export { cache };

/**
 * Upload a file to backend storage (MinIO) and return its URL payload.
 */
export async function uploadToStorage(file: File, folder: string = 'uploads'): Promise<{ url: string; filename: string; content_type: string; size: number }>{
  const token = getToken();
  const form = new FormData();
  form.append('file', file);

  const url = `${getBackendUrl()}/storage/upload?folder=${encodeURIComponent(folder)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return resp.json();
}
