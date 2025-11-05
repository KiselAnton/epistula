#!/usr/bin/env tsx
/**
 * Standalone script to create E2E test data
 * Can be run independently or as part of test setup
 */

import { request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const backendBase = process.env.BACKEND_URL || 'http://localhost:8000';
const rootEmail = process.env.ROOT_EMAIL || 'root@localhost.localdomain';
const rootPassword = process.env.ROOT_PASSWORD || 'changeme123';

async function setupE2EData() {
  console.log('[E2E Setup] Starting E2E data creation...');
  console.log(`[E2E Setup] Backend: ${backendBase}`);
  console.log(`[E2E Setup] Root email: ${rootEmail}`);

  const api = await request.newContext({ baseURL: backendBase });

  try {
    // 1. Login as root
    console.log('[E2E Setup] Authenticating...');
    const loginResp = await api.post('/api/v1/auth/login', {
      data: { email: rootEmail, password: rootPassword },
    });

    if (!loginResp.ok()) {
      const text = await loginResp.text();
      throw new Error(`Failed to authenticate: ${loginResp.status()} ${text}`);
    }

    const loginData = await loginResp.json();
    const token = loginData.access_token as string;
    console.log('[E2E Setup] ✓ Authenticated successfully');

    // 2. Create or find E2E University
    const uniName = 'E2E University';
    const uniCode = 'E2EUNI';
    let universityId = 0;

    console.log('[E2E Setup] Creating E2E University...');
    const uniResp = await api.post('/api/v1/universities/', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: uniName, code: uniCode, description: 'E2E seeded university' },
    });

    if (!uniResp.ok()) {
      console.log('[E2E Setup] University creation failed, trying to find existing...');
      const list = await api.get('/api/v1/universities/', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (list.ok()) {
        const items = await list.json();
        const found = Array.isArray(items) ? items.find((u: any) => u.code === uniCode) : undefined;
        
        if (found) {
          universityId = found.id;
          console.log(`[E2E Setup] ✓ Found existing university (ID: ${universityId})`);
        } else {
          throw new Error(`Failed to create or find university: ${await uniResp.text()}`);
        }
      } else {
        throw new Error(`Failed to create or find university: ${await uniResp.text()}`);
      }
    } else {
      const uniData = await uniResp.json();
      universityId = uniData.id;
      console.log(`[E2E Setup] ✓ Created university (ID: ${universityId})`);
    }

    // 3. Create E2E Faculty
    let facultyId = 0;
    console.log('[E2E Setup] Creating E2E Faculty...');
    const facResp = await api.post(`/api/v1/faculties/${universityId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { 
        name: 'E2E Faculty', 
        short_name: 'E2EF', 
        code: 'E2EF', 
        description: 'E2E seeded faculty' 
      },
    });

    if (!facResp.ok()) {
      console.log('[E2E Setup] Faculty creation failed, trying to find existing...');
      const listFac = await api.get(`/api/v1/faculties/${universityId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (listFac.ok()) {
        const items = await listFac.json();
        const found = Array.isArray(items) ? items.find((f: any) => f.code === 'E2EF') : undefined;
        
        if (found) {
          facultyId = found.id;
          console.log(`[E2E Setup] ✓ Found existing faculty (ID: ${facultyId})`);
        } else {
          throw new Error(`Failed to create or find faculty: ${await facResp.text()}`);
        }
      } else {
        throw new Error(`Failed to create or find faculty: ${await facResp.text()}`);
      }
    } else {
      const facData = await facResp.json();
      facultyId = facData.id;
      console.log(`[E2E Setup] ✓ Created faculty (ID: ${facultyId})`);
    }

    // 4. Create E2E Subject
    let subjectId = 0;
    console.log('[E2E Setup] Creating E2E Subject...');
    const subjResp = await api.post(`/api/v1/subjects/${universityId}/${facultyId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { 
        name: 'E2E Subject', 
        code: 'E2ES', 
        description: 'E2E seeded subject' 
      },
    });

    if (!subjResp.ok()) {
      console.log('[E2E Setup] Subject creation failed, trying to find existing...');
      const listSubj = await api.get(`/api/v1/subjects/${universityId}/${facultyId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (listSubj.ok()) {
        const items = await listSubj.json();
        const found = Array.isArray(items) ? items.find((s: any) => s.code === 'E2ES') : undefined;
        
        if (found) {
          subjectId = found.id;
          console.log(`[E2E Setup] ✓ Found existing subject (ID: ${subjectId})`);
        } else {
          throw new Error(`Failed to create or find subject: ${await subjResp.text()}`);
        }
      } else {
        throw new Error(`Failed to create or find subject: ${await subjResp.text()}`);
      }
    } else {
      const subjData = await subjResp.json();
      subjectId = subjData.id;
      console.log(`[E2E Setup] ✓ Created subject (ID: ${subjectId})`);
    }

    // 5. Save IDs for tests
    const authDir = path.join(process.cwd(), 'tests-e2e', '.auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const idsPath = path.join(authDir, 'ids.json');
    const ids = { universityId, facultyId, subjectId };
    fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2));
    console.log(`[E2E Setup] ✓ Saved IDs to ${idsPath}`);
    console.log(`[E2E Setup] IDs: ${JSON.stringify(ids)}`);

    console.log('[E2E Setup] ✅ E2E data setup complete!');
    return ids;

  } catch (error: any) {
    console.error('[E2E Setup] ❌ Setup failed:', error.message);
    throw error;
  } finally {
    await api.dispose();
  }
}

// Run if called directly
if (require.main === module) {
  setupE2EData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default setupE2EData;
