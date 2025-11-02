import { getBackendUrl } from '../lib/config';
import { saveJson } from './dataTransfer.api';

function ensureToken(token?: string | null): string {
  const t = token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (!t) throw new Error('Unauthorized: missing token');
  return t;
}

export async function exportSubjectProfessorsFiltered(
  universityId: number | string,
  subjectId: number | string,
  opts?: { token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`;
  const body = { entity_type: 'subject_professors', entity_ids: null, from_temp: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const filtered = Array.isArray(data?.data) ? data.data.filter((r: any) => r.subject_id === Number(subjectId)) : [];
  const wrapped = { ...data, data: filtered, count: filtered.length };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}_subject-${subjectId}_subject_professors_${ts}.json`;
  saveJson(fname, wrapped);
  return wrapped;
}

export async function exportSubjectStudentsFiltered(
  universityId: number | string,
  subjectId: number | string,
  opts?: { token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`;
  const body = { entity_type: 'subject_students', entity_ids: null, from_temp: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const filtered = Array.isArray(data?.data) ? data.data.filter((r: any) => r.subject_id === Number(subjectId)) : [];
  const wrapped = { ...data, data: filtered, count: filtered.length };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}_subject-${subjectId}_subject_students_${ts}.json`;
  saveJson(fname, wrapped);
  return wrapped;
}

export function exportSubjectStudentsLocal(
  universityId: number | string,
  subjectId: number | string,
  students: Array<{ student_id: number; status?: string }>,
  opts?: { filenameHint?: string }
) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}_subject-${subjectId}_subject_students_${ts}.json`;
  const payload = {
    entity_type: 'subject_students',
    source_schema: `university-${universityId}`,
    count: students.length,
    exported_at: new Date().toISOString(),
    data: students,
    columns: ['student_id', 'status']
  };
  saveJson(fname, payload);
  return payload;
}

export async function exportLecturesFiltered(
  universityId: number | string,
  subjectId: number | string,
  opts?: { token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`;
  const body = { entity_type: 'lectures', entity_ids: null, from_temp: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const filtered = Array.isArray(data?.data) ? data.data.filter((r: any) => r.subject_id === Number(subjectId)) : [];
  const wrapped = { ...data, data: filtered, count: filtered.length };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}_subject-${subjectId}_lectures_${ts}.json`;
  saveJson(fname, wrapped);
  return wrapped;
}

export async function exportLectureMaterialsFiltered(
  universityId: number | string,
  lectureId: number | string,
  opts?: { token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`;
  const body = { entity_type: 'lecture_materials', entity_ids: null, from_temp: false };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  const filtered = Array.isArray(data?.data) ? data.data.filter((r: any) => r.lecture_id === Number(lectureId)) : [];
  const wrapped = { ...data, data: filtered, count: filtered.length };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}_lecture-${lectureId}_lecture_materials_${ts}.json`;
  saveJson(fname, wrapped);
  return wrapped;
}
