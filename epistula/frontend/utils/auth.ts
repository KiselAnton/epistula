/**
 * Authentication utilities for getting current user info from localStorage
 */

export type UserRole = 'root' | 'uni_admin' | 'professor' | 'student';

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  universities?: number[];
  primary_university_id?: number;
}

/**
 * Get the current user from localStorage
 * @returns The current user object or null if not authenticated
 */
export function getCurrentUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return null;
    
    return JSON.parse(userRaw) as CurrentUser;
  } catch {
    return null;
  }
}

/**
 * Get the current user's role
 * @returns The user's role or undefined if not authenticated
 */
export function getCurrentUserRole(): UserRole | undefined {
  const user = getCurrentUser();
  return user?.role;
}
