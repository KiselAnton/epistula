import { chromium, FullConfig, request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Minimal helper to ensure directory exists
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function globalSetup(config: FullConfig) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const frontendBase = process.env.EPISTULA_E2E_BASE_URL || `http://localhost:${port}`;
  const backendBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000';

  // Root credentials: align with actual backend env (user may have custom .env)
  const rootEmail = process.env.EPISTULA_ROOT_EMAIL || process.env.NEXT_PUBLIC_ROOT_EMAIL || 'root@localhost.localdomain';
  const rootPassword = process.env.EPISTULA_ROOT_PASSWORD || 'changeme123';

  // 1) Obtain API token by logging in directly
  const api = await request.newContext({ baseURL: backendBase });
  const loginResp = await api.post('/api/v1/auth/login', {
    data: { email: rootEmail, password: rootPassword },
  });
  if (!loginResp.ok()) {
    const text = await loginResp.text();
    throw new Error(`Failed to authenticate root user: ${loginResp.status()} ${text}`);
  }
  const loginData = await loginResp.json();
  const token = loginData.access_token as string;
  const user = loginData.user as any;

  // 2) Prime frontend storage (localStorage) with token and user, then save storageState
  const authDir = path.join(process.cwd(), 'tests-e2e', '.auth');
  ensureDir(authDir);
  const storageStatePath = path.join(authDir, 'user.json');

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Go to the app and set localStorage
  await page.goto(frontendBase + '/');
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('token', t);
    if (u) localStorage.setItem('user', JSON.stringify(u));
  }, { t: token, u: user });
  // Navigate to a protected page to ensure auth takes effect and cookies/storage captured
  await page.goto(frontendBase + '/dashboard');
  await page.waitForLoadState('networkidle');

  await ctx.storageState({ path: storageStatePath });
  await browser.close();

  // 3) Seed minimal entities for optional UI tests (uni -> faculty -> subject)
  //    This makes optional UI specs runnable when enabled.
  const idsPath = path.join(authDir, 'ids.json');
  let seeded = { universityId: 0, facultyId: 0, subjectId: 0 };

  try {
    // Create University (root only)
    const uniName = 'E2E University';
    const uniCode = 'E2EUNI';
    const uniResp = await api.post('/api/v1/universities/', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: uniName, code: uniCode, description: 'E2E seeded university' },
    });
    if (!uniResp.ok()) {
      // Maybe it already exists; try to list and pick by code
      const list = await api.get('/api/v1/universities/', { headers: { Authorization: `Bearer ${token}` } });
      const items = list.ok() ? await list.json() : [];
      const found = Array.isArray(items) ? items.find((u: any) => u.code === uniCode) : undefined;
      if (!found) throw new Error(`Failed to create or find university: ${await uniResp.text()}`);
      seeded.universityId = found.id;
    } else {
      const uniData = await uniResp.json();
      seeded.universityId = uniData.id;
    }

    // Create Faculty
    const facResp = await api.post(`/api/v1/faculties/${seeded.universityId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'E2E Faculty', short_name: 'E2EF', code: 'E2EF', description: 'E2E seeded faculty' },
    });
    if (!facResp.ok()) {
      // Try to list and find
      const listFac = await api.get(`/api/v1/faculties/${seeded.universityId}`, { headers: { Authorization: `Bearer ${token}` } });
      const items = listFac.ok() ? await listFac.json() : [];
      const found = Array.isArray(items) ? items.find((f: any) => f.code === 'E2EF') : undefined;
      if (!found) throw new Error(`Failed to create or find faculty: ${await facResp.text()}`);
      seeded.facultyId = found.id;
    } else {
      const facData = await facResp.json();
      seeded.facultyId = facData.id;
    }

    // Create Subject
    const subjResp = await api.post(`/api/v1/subjects/${seeded.universityId}/${seeded.facultyId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'E2E Subject', code: 'E2ES', description: 'E2E seeded subject' },
    });
    if (!subjResp.ok()) {
      // Try to list and find
      const listSubj = await api.get(`/api/v1/subjects/${seeded.universityId}/${seeded.facultyId}`, { headers: { Authorization: `Bearer ${token}` } });
      const items = listSubj.ok() ? await listSubj.json() : [];
      const found = Array.isArray(items) ? items.find((s: any) => s.code === 'E2ES') : undefined;
      if (!found) throw new Error(`Failed to create or find subject: ${await subjResp.text()}`);
      seeded.subjectId = found.id;
    } else {
      const subjData = await subjResp.json();
      seeded.subjectId = subjData.id;
    }
  } catch (e) {
    // Leave ids as zeros if seeding fails; optional tests may skip or handle gracefully
    // eslint-disable-next-line no-console
    console.warn('[global-setup] Seeding failed or partial:', e);
  } finally {
    fs.writeFileSync(idsPath, JSON.stringify(seeded, null, 2));
    await api.dispose();
  }
}

export default globalSetup;
