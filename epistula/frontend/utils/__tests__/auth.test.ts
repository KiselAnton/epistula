/**
 * Tests for authentication utility functions
 */

import { getCurrentUser, getCurrentUserRole } from '../auth';

describe('Auth Utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getCurrentUser', () => {
    it('should return null when no user is stored', () => {
      const user = getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return null when user data is invalid JSON', () => {
      localStorage.setItem('user', 'invalid-json{');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return user object when valid user is stored', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'student' as const,
        universities: [1, 2],
        primary_university_id: 1,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const user = getCurrentUser();

      expect(user).toEqual(mockUser);
      expect(user?.id).toBe(1);
      expect(user?.email).toBe('test@example.com');
      expect(user?.role).toBe('student');
    });

    it('should handle user with root role', () => {
      const mockUser = {
        id: 1,
        email: 'root@localhost',
        name: 'Root User',
        role: 'root' as const,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const user = getCurrentUser();

      expect(user?.role).toBe('root');
    });

    it('should handle user with uni_admin role', () => {
      const mockUser = {
        id: 2,
        email: 'admin@university.edu',
        name: 'University Admin',
        role: 'uni_admin' as const,
        universities: [1],
        primary_university_id: 1,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const user = getCurrentUser();

      expect(user?.role).toBe('uni_admin');
      expect(user?.universities).toContain(1);
    });

    it('should handle user with professor role', () => {
      const mockUser = {
        id: 3,
        email: 'prof@university.edu',
        name: 'Professor',
        role: 'professor' as const,
        universities: [1],
        primary_university_id: 1,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const user = getCurrentUser();

      expect(user?.role).toBe('professor');
    });
  });

  describe('getCurrentUserRole', () => {
    it('should return undefined when no user is stored', () => {
      const role = getCurrentUserRole();
      expect(role).toBeUndefined();
    });

    it('should return undefined when user data is invalid', () => {
      localStorage.setItem('user', 'invalid');
      const role = getCurrentUserRole();
      expect(role).toBeUndefined();
    });

    it('should return student role', () => {
      const mockUser = {
        id: 1,
        email: 'student@example.com',
        name: 'Student',
        role: 'student' as const,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const role = getCurrentUserRole();

      expect(role).toBe('student');
    });

    it('should return root role', () => {
      const mockUser = {
        id: 1,
        email: 'root@localhost',
        name: 'Root',
        role: 'root' as const,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const role = getCurrentUserRole();

      expect(role).toBe('root');
    });

    it('should return uni_admin role', () => {
      const mockUser = {
        id: 1,
        email: 'admin@university.edu',
        name: 'Admin',
        role: 'uni_admin' as const,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const role = getCurrentUserRole();

      expect(role).toBe('uni_admin');
    });

    it('should return professor role', () => {
      const mockUser = {
        id: 1,
        email: 'prof@university.edu',
        name: 'Professor',
        role: 'professor' as const,
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const role = getCurrentUserRole();

      expect(role).toBe('professor');
    });
  });

  describe('Edge cases', () => {
    it('should handle missing role field', () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test',
        // role is missing
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      const role = getCurrentUserRole();

      expect(role).toBeUndefined();
    });

    it('should handle null user object', () => {
      localStorage.setItem('user', 'null');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });

    it('should handle empty string in localStorage', () => {
      localStorage.setItem('user', '');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });
  });
});
