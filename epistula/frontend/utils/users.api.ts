import { getBackendUrl } from './api';
import { User } from '../types';

export async function fetchUsersByRole(
  universityId: string | number,
  role: 'professor' | 'student' | 'uni_admin',
  token: string
): Promise<User[]> {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/universities/${universityId}/users?role=${role}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error(`Failed to fetch ${role}s`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : (data.users || []);
}
