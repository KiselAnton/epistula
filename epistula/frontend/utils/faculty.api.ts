import { getBackendUrl } from './api';
import { FacultyProfessor, FacultyStudent, User } from '../types';

/**
 * Faculty Professors API
 */
export async function fetchFacultyProfessors(
  universityId: string | number,
  facultyId: string | number,
  token: string
): Promise<FacultyProfessor[]> {
  const url = `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/professors`;
  console.log('Fetching faculty professors from:', url);
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  console.log('Response status:', response.status);

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Failed to fetch faculty professors');
  }

  const data = await response.json();
  console.log('Faculty professors data:', data);
  return Array.isArray(data) ? data : [];
}

export async function assignProfessorToFaculty(
  universityId: string | number,
  facultyId: string | number,
  professorId: number,
  token: string
): Promise<FacultyProfessor> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/professors`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ professor_id: professorId })
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to assign professor');
  }

  return response.json();
}

export async function removeProfessorFromFaculty(
  universityId: string | number,
  facultyId: string | number,
  professorId: number,
  token: string
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/professors/${professorId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to remove professor');
  }
}

/**
 * Faculty Students API
 */
export async function fetchFacultyStudents(
  universityId: string | number,
  facultyId: string | number,
  token: string
): Promise<FacultyStudent[]> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/students`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Failed to fetch faculty students');
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function assignStudentToFaculty(
  universityId: string | number,
  facultyId: string | number,
  studentId: number,
  token: string
): Promise<FacultyStudent> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/students`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ student_id: studentId })
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to assign student');
  }

  return response.json();
}

export async function removeStudentFromFaculty(
  universityId: string | number,
  facultyId: string | number,
  studentId: number,
  token: string
): Promise<void> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/faculties/${universityId}/${facultyId}/students/${studentId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to remove student');
  }
}
