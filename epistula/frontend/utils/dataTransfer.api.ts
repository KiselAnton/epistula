import { getBackendUrl } from '../lib/config';

function ensureToken(token?: string | null): string {
  const t = token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (!t) throw new Error('Unauthorized: missing token');
  return t;
}

export function saveJson(filename: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportFacultyFull(
  universityId: number | string,
  facultyId: number | string,
  opts?: { fromTemp?: boolean; token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const fromTemp = !!opts?.fromTemp;
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export/faculty/${facultyId}${fromTemp ? '?from_temp=true' : ''}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}${fromTemp ? '-temp' : ''}_faculty-${facultyId}_export_${ts}.json`;
  saveJson(fname, data);
  return data;
}

export async function exportEntities(
  universityId: number | string,
  entityType: string,
  entityIds?: number[] | string[] | null,
  opts?: { fromTemp?: boolean; token?: string | null; filenameHint?: string }
) {
  const token = ensureToken(opts?.token ?? null);
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/export`;
  const body = {
    entity_type: entityType,
    entity_ids: entityIds ?? null,
    from_temp: !!opts?.fromTemp,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Export failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = opts?.filenameHint || `university-${universityId}${opts?.fromTemp ? '-temp' : ''}_${entityType}_export_${ts}.json`;
  saveJson(fname, data);
  return data;
}

export async function importFacultyFull(
  universityId: number | string,
  facultyPayload: any,
  opts?: { strategy?: 'replace' | 'merge' | 'skip_existing'; toTemp?: boolean; token?: string | null }
) {
  const token = ensureToken(opts?.token ?? null);
  const strategy = opts?.strategy ?? 'merge';
  const toTemp = !!opts?.toTemp;
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/import/faculty?strategy=${encodeURIComponent(strategy)}&to_temp=${toTemp ? 'true' : 'false'}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(facultyPayload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Import failed (HTTP ${res.status})`);
  }

  return res.json();
}

export async function importEntities(
  universityId: number | string,
  entityType: string,
  data: any[],
  opts?: { strategy?: 'replace' | 'merge' | 'skip_existing'; toTemp?: boolean; token?: string | null }
) {
  const token = ensureToken(opts?.token ?? null);
  const strategy = opts?.strategy ?? 'merge';
  const toTemp = !!opts?.toTemp;
  const url = `${getBackendUrl()}/api/v1/data-transfer/${universityId}/import`;

  const body = {
    entity_type: entityType,
    data,
    strategy,
    to_temp: toTemp,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err?.detail || `Import failed (HTTP ${res.status})`);
  }

  return res.json();
}
