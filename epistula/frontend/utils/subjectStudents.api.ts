import { getBackendUrl } from '../lib/config';

function ensureToken(token?: string | null): string {
  const t = token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (!t) throw new Error('Unauthorized: missing token');
  return t;
}

export async function enrollStudentsInSubject(
  universityId: number | string,
  facultyId: number | string,
  subjectId: number | string,
  studentIds: Array<number | string>,
  opts?: { token?: string | null }
) {
  const token = ensureToken(opts?.token ?? null);
  const base = `${getBackendUrl()}/api/v1/subjects/${universityId}/${facultyId}/${subjectId}/students`;
  const results = [] as Array<{ ok: boolean; status: number; error?: string; id: number | string }>;
  for (const sid of studentIds) {
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: Number(sid) })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        results.push({ ok: false, status: res.status, error: err?.detail || `HTTP ${res.status}` , id: sid });
      } else {
        results.push({ ok: true, status: res.status, id: sid });
      }
    } catch (e: any) {
      results.push({ ok: false, status: 0, error: e?.message || 'Network error', id: sid });
    }
  }
  return results;
}
