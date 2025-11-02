/**
 * API functions for universities
 */
import { apiRequest, uploadFile } from './api';
import { University } from '../types';

export const universitiesApi = {
  list: () => apiRequest<University[]>('/api/v1/universities/'),
  
  create: (data: { name: string; code: string; description?: string }) =>
    apiRequest<University>('/api/v1/universities/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    apiRequest<void>(`/api/v1/universities/${id}`, {
      method: 'DELETE',
    }),
  
  uploadLogo: (id: number, file: File) =>
    uploadFile<University>(`/api/v1/universities/${id}/logo`, file),
};
