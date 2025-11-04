/**
 * Shared constants for E2E tests
 */

// Test credentials
export const TEST_CREDENTIALS = {
  ROOT: {
    email: 'root@localhost.localdomain',
    password: 'changeme123',
  },
  ADMIN: {
    email: 'test_admin@site.com',
    password: 'changeme123',
  },
};

// Common selectors
export const SELECTORS = {
  // Auth
  LOGIN_EMAIL: 'input[type="email"]',
  LOGIN_PASSWORD: 'input[type="password"]',
  LOGIN_SUBMIT: 'button[type="submit"]',
  
  // Navigation
  UNIVERSITIES_NAV: 'a[href="/universities"]',
  
  // Cards and lists
  UNIVERSITY_CARD: '[class*="universityCard"]',
  FACULTY_CARD: '[class*="facultyCard"]',
  SUBJECT_CARD: '[class*="subjectCard"], [class*="subject"]',
  
  // Buttons
  MANAGE_FACULTIES_BTN: 'button:has-text("Manage All"), button:has-text("Manage Faculties")',
  MANAGE_SUBJECTS_BTN: 'a:has-text("Subjects"), button:has-text("Manage Subjects")',
  CREATE_LECTURE_BTN: 'button:has-text("Create Lecture"), button:has-text("Add Lecture"), button:has-text("New Lecture")',
  CREATE_USER_BTN: 'button:has-text("Create User")',
  ASSIGN_PROFESSOR_BTN: 'button:has-text("Assign Professor"), button:has-text("Add Professor")',
  ASSIGN_STUDENT_BTN: 'button:has-text("Assign Student"), button:has-text("Add Student")',
  
  // Forms
  INPUT_NAME: 'input[name="name"]',
  INPUT_EMAIL: 'input[name="email"]',
  INPUT_PASSWORD: 'input[name="password"]',
  SELECT_ROLE: 'select[name="role"]',
  
  // Common
  SUBMIT_BTN: 'button[type="submit"]',
  CANCEL_BTN: 'button:has-text("Cancel"), button:has-text("Close")',
};

// Test data
export const TEST_DATA = {
  E2E_UNIVERSITY_NAME: 'E2E University',
};

// Timeouts
export const TIMEOUTS = {
  SHORT: 300,
  DEFAULT: 1000,
  MEDIUM: 2000,
  LONG: 3000,
  NAVIGATION: 5000,
};

// URL patterns
export const URL_PATTERNS = {
  DASHBOARD: '**/dashboard',
  UNIVERSITIES: '**/universities',
  UNIVERSITY_DETAIL: '**/university/**',
  FACULTIES: '**/university/**/faculties',
  FACULTY_DETAIL: '**/university/**/faculty/**',
  SUBJECT_DETAIL: '**/subject/**',
};
