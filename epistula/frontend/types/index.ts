/**
 * Shared TypeScript interfaces for Epistula application
 */

export interface University {
  id: number;
  name: string;
  code: string;
  schema_name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  is_active: boolean;
}

export interface Faculty {
  id: number;
  university_id: number;
  name: string;
  short_name: string;
  code: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  is_active: boolean;
}

export interface Subject {
  id: number;
  faculty_id: number;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
  logo_url?: string | null;
}

export interface User {
  id: number;
  email: string;
  name: string;
  is_root: boolean;
  is_active: boolean;
  created_at: string;
}

export interface FacultyProfessor {
  id: number;
  professor_id: number;
  professor_name: string;
  professor_email: string;
  assigned_at: string;
  assigned_by: number;
  is_active: boolean;
}

export interface FacultyStudent {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  assigned_at: string;
  assigned_by: number;
  is_active: boolean;
}

export interface Professor {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  subject_count: number;
}

export interface Student {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  subject_count: number;
  enrollment_status: string;
}

export interface SubjectProfessor {
  id: number;
  professor_id: number;
  professor_name: string;
  professor_email: string;
  assigned_at: string;
  is_active: boolean;
}

export interface SubjectStudent {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  enrolled_at: string;
  status: string;
}

export interface Lecture {
  id: number;
  subject_id: number;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  created_at: string;
  created_by: number;
  is_active: boolean;
}
