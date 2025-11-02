/**
 * API functions for faculties
 */
import { apiRequest, uploadFile } from './api';
import { Faculty } from '../types';

export const facultiesApi = {
  list: (universityId: number) =>
    apiRequest<Faculty[]>(`/api/v1/faculties/${universityId}`),
  
  create: (universityId: number, data: { name: string; short_name: string; code: string; description?: string }) =>
    apiRequest<Faculty>(`/api/v1/faculties/${universityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  
  delete: (universityId: number, facultyId: number) =>
    apiRequest<void>(`/api/v1/faculties/${universityId}/${facultyId}`, {
      method: 'DELETE',
    }),
  
  uploadLogo: (universityId: number, facultyId: number, file: File) =>
    uploadFile<Faculty>(`/api/v1/faculties/${universityId}/${facultyId}/logo`, file),
};
