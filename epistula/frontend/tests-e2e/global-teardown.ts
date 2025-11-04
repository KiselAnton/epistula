import { request, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export default async function globalTeardown(_config: FullConfig) {
  try {
    const authDir = path.join(process.cwd(), 'tests-e2e', '.auth');
    const idsPath = path.join(authDir, 'ids.json');
    if (!fs.existsSync(idsPath)) return;

    const ids = JSON.parse(fs.readFileSync(idsPath, 'utf-8')) as { universityId?: number };
    if (!ids?.universityId) return;

    const backendBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000';
    const rootEmail = process.env.EPISTULA_ROOT_EMAIL || process.env.NEXT_PUBLIC_ROOT_EMAIL || 'root@localhost.localdomain';
    const rootPassword = process.env.EPISTULA_ROOT_PASSWORD || 'changeme123';

    const api = await request.newContext({ baseURL: backendBase });
    const loginResp = await api.post('/api/v1/auth/login', { data: { email: rootEmail, password: rootPassword } });
    if (!loginResp.ok()) {
      await api.dispose();
      return;
    }
    const { access_token } = await loginResp.json();

    // Delete the seeded university
    await api.delete(`/api/v1/universities/${ids.universityId}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    await api.dispose();
  } catch {
    // Best effort teardown
  }
}
