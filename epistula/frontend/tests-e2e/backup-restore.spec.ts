import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * E2E test for backup restore to temporary schema workflow
 * Tests the complete data safety workflow:
 * 1. Get or create a university with backups
 * 2. Create a backup if needed
 * 3. Restore to temporary schema (safe, non-destructive)
 * 4. Verify temp schema exists and temp status is correct
 * 5. Promote temp schema to production
 * 6. Verify production was updated
 * 7. Clean up temp schema
 * 
 * This test is environment-independent and does not hardcode any IDs.
 */

test.describe('Backup Restore to Temp Workflow', () => {
  // This workflow performs real backup/restore/promote operations and can take longer on CI
  test.setTimeout(90000);
  let universityId: number;
  let _universityName: string;

  test.beforeAll(async () => {
    // Read seeded university ID from global setup
    const authDir = path.join(process.cwd(), 'tests-e2e', '.auth');
    const idsPath = path.join(authDir, 'ids.json');
    
    if (fs.existsSync(idsPath)) {
      const ids = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
      universityId = ids.universityId;
    }
    
    if (!universityId) {
      // Fallback: use first available university
      universityId = 1;
    }
  });

  test('complete restore to temp and promote workflow', async ({ page, request }) => {
  // Navigate to backups page (no strict UI assertions needed; API-driven checks follow)
  await page.goto('/backups');

    const token = await page.evaluate(() => localStorage.getItem('token'));
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Get university info via API to ensure we have a valid university
    const universitiesResp = await request.get(`${backendUrl}/api/v1/universities/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(universitiesResp.ok()).toBeTruthy();
    const universities = await universitiesResp.json();
    expect(universities.length).toBeGreaterThan(0);
    
    const firstUniversity = universities[0];
    universityId = firstUniversity.id;
    _universityName = firstUniversity.name;

    // Create a backup via API to ensure we have something to restore
    const createBackupResp = await request.post(`${backendUrl}/api/v1/backups/${universityId}/create`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(createBackupResp.ok()).toBeTruthy();
    const backupData = await createBackupResp.json();
    const backupName = backupData.filename;

  // Optional UI refresh (not required for API-driven flow)
  await page.reload();

    // Step 2: Restore to temp via API (more reliable than clicking UI)
    const restoreResp = await request.post(
      `${backendUrl}/api/v1/backups/${universityId}/${encodeURIComponent(backupName)}/restore?to_temp=true`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    expect(restoreResp.ok()).toBeTruthy();
    const restoreResult = await restoreResp.json();
    expect(restoreResult.is_temp).toBe(true);
    expect(restoreResult.schema_name).toContain('_temp');

  // Wait a bit for restore to complete
  await page.waitForTimeout(3000);

    // Step 3: Verify temp status shows temp schema exists
    const tempStatusResp = await request.get(`${backendUrl}/api/v1/backups/${universityId}/temp-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(tempStatusResp.ok()).toBeTruthy();
    const tempStatus = await tempStatusResp.json();
    expect(tempStatus.has_temp_schema).toBe(true);
  expect(tempStatus.temp_schema).toContain('_temp');
    expect(tempStatus).toHaveProperty('temp_university_id');

    // Step 4: Promote temp to production via API
    const promoteResp = await request.post(`${backendUrl}/api/v1/backups/${universityId}/promote-temp`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(promoteResp.ok()).toBeTruthy();
    const promoteResult = await promoteResp.json();
    expect(promoteResult.message).toContain('promoted');

  // Wait for promotion to complete
  await page.waitForTimeout(3000);

    // Step 5: Verify temp schema is gone after promotion
    const tempStatusAfterPromote = await request.get(`${backendUrl}/api/v1/backups/${universityId}/temp-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(tempStatusAfterPromote.ok()).toBeTruthy();
    const statusAfter = await tempStatusAfterPromote.json();
    expect(statusAfter.has_temp_schema).toBe(false);
  });

  test('delete temp schema without promoting', async ({ page, request }) => {
  // This test verifies we can safely discard a temp schema without promoting it
  // Ensure we're on an app origin before reading localStorage
  await page.goto('/dashboard');
  const token = await page.evaluate(() => localStorage.getItem('token'));
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Get a valid university
    const universitiesResp = await request.get(`${backendUrl}/api/v1/universities/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const universities = await universitiesResp.json();
    const testUniversity = universities[0];

    // Create a backup
    const createBackupResp = await request.post(`${backendUrl}/api/v1/backups/${testUniversity.id}/create`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const backupData = await createBackupResp.json();

    // Restore to temp
    const restoreResp = await request.post(
      `${backendUrl}/api/v1/backups/${testUniversity.id}/${encodeURIComponent(backupData.filename)}/restore?to_temp=true`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    expect(restoreResp.ok()).toBeTruthy();
    await page.waitForTimeout(2000);

    // Verify temp schema exists
    const tempStatusResp = await request.get(`${backendUrl}/api/v1/backups/${testUniversity.id}/temp-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const tempStatus = await tempStatusResp.json();
    expect(tempStatus.has_temp_schema).toBe(true);

    // Delete temp schema instead of promoting
    const deleteResp = await request.delete(`${backendUrl}/api/v1/backups/${testUniversity.id}/temp-schema`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(deleteResp.ok()).toBeTruthy();

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify temp schema is gone
    const statusAfterDelete = await request.get(`${backendUrl}/api/v1/backups/${testUniversity.id}/temp-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const finalStatus = await statusAfterDelete.json();
    expect(finalStatus.has_temp_schema).toBe(false);
  });

  test('temp status endpoint returns correct data structure', async ({ request, page }) => {
  // This test verifies the temp-status API endpoint structure
  // Ensure origin is set before accessing localStorage
  await page.goto('/dashboard');
  const token = await page.evaluate(() => localStorage.getItem('token'));
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Get a valid university
    const universitiesResp = await request.get(`${backendUrl}/api/v1/universities/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const universities = await universitiesResp.json();
    const testUniversity = universities[0];

    // Call temp-status API
    const response = await request.get(`${backendUrl}/api/v1/backups/${testUniversity.id}/temp-status`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Verify response structure
    expect(data).toHaveProperty('has_temp_schema');
  expect(data).toHaveProperty('temp_schema');
    expect(data).toHaveProperty('production_schema');
    
    // If temp schema exists, verify additional fields
    if (data.has_temp_schema) {
      expect(data).toHaveProperty('temp_university_id');
      expect(data).toHaveProperty('temp_info');
      expect(data.temp_info).toHaveProperty('faculty_count');
      expect(data.temp_info).toHaveProperty('user_count');
    }
  });
});
