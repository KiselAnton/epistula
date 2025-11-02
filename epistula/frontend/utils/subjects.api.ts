/**
 * API functions for subjects
 */
import { apiRequest } from './api';
import { Subject } from '../types';

export const subjectsApi = {
  list: (universityId: number, facultyId: number) =>
    apiRequest<Subject[]>(`/api/v1/subjects/${universityId}/${facultyId}`),
  
  create: (universityId: number, facultyId: number, data: { name: string; code: string; description?: string }) =>
    apiRequest<Subject>(`/api/v1/subjects/${universityId}/${facultyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  
  delete: (universityId: number, facultyId: number, subjectId: number) =>
    apiRequest<void>(`/api/v1/subjects/${universityId}/${facultyId}/${subjectId}`, {
      method: 'DELETE',
    }),
};
