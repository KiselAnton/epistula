import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Verifies per-row strategy selection is applied to import requests.
 * - Ensures a temp schema exists
 * - Opens Backups → Data Transfer panel
 * - Picks the first row with an enabled Export button
 * - Sets row strategy to Replace
 * - Exports (mocked) and then Imports (mocked)
 * - Asserts the import request payload contains strategy: "replace"
 */
test.describe('Data Transfer per-row strategy selector', () => {
  let universityId: number;

  test.beforeAll(async () => {
    // Try to read seeded university id from global setup (if present)
    const authDir = path.join(process.cwd(), 'tests-e2e', '.auth');
    const idsPath = path.join(authDir, 'ids.json');
    if (fs.existsSync(idsPath)) {
      const ids = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
      universityId = ids.universityId;
    }
    if (!universityId) universityId = 1;
  });

  test('row strategy select influences import payload', async ({ page, request }) => {
    // Ensure origin before accessing localStorage
    await page.goto('/dashboard');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Pick a valid university (first)
    const universitiesResp = await request.get(`${backendUrl}/api/v1/universities/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(universitiesResp.ok()).toBeTruthy();
    const universities = await universitiesResp.json();
    expect(universities.length).toBeGreaterThan(0);
    const testUniversity = universities[0];
    universityId = testUniversity.id;

    // Navigate to Backups and expand panel
    await page.goto('/backups');
    await page.waitForTimeout(500);

    // Expand the first university section and open Data Transfer panel
    await page.locator('text=Backup Management').waitFor();
    const firstToggle = page.locator('button[title="Expand section"]').first();
    if (await firstToggle.isVisible()) {
      await firstToggle.click();
    }

    // Open the Data Transfer panel toggle
  const dataTransferToggle = page.getByRole('button', { name: /Data Transfer \(Temp ↔ Production\)/ });
  await dataTransferToggle.waitFor({ state: 'visible' });
  await dataTransferToggle.click();

    // Accept confirmation dialogs automatically
    page.on('dialog', (dialog) => dialog.accept());

    // Set up route mocks: temp-status says temp exists; entities show counts; capture export and import
    let seenImportPayload: any = null;

    await page.route(`${backendUrl}/api/v1/backups/${universityId}/temp-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: universityId,
          university_name: 'Test',
          has_temp_schema: true,
          temp_schema: `uni_${universityId}_temp`,
          production_schema: `uni_${universityId}`,
          temp_university_id: universityId,
          temp_info: { faculty_count: 1, user_count: 1 },
        }),
      });
    });

    await page.route(new RegExp(`${backendUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/v1/data-transfer/${universityId}/entities\?from_temp=.*`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: universityId,
          schema_name: `uni_${universityId}`,
          is_temp: route.request().url().includes('from_temp=true'),
          entities: {
            faculties: 1,
            subjects: 1,
            faculty_professors: 0,
            faculty_students: 0,
            subject_professors: 0,
            lectures: 0,
            lecture_materials: 0,
          },
          total_entities: 2,
        }),
      });
    });

    await page.route(`${backendUrl}/api/v1/data-transfer/${universityId}/export`, async (route) => {
      const req = route.request();
      const body = req.postDataJSON() as any;
      const entityType = body?.entity_type || 'faculties';
      // Return minimal export payload matching UI expectations
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entity_type: entityType,
          source_schema: `uni_${universityId}_temp`,
          count: 1,
          exported_at: new Date().toISOString(),
          data: [{ id: 1 }],
          columns: ['id'],
        }),
      });
    });

    await page.route(`${backendUrl}/api/v1/data-transfer/${universityId}/import`, async (route) => {
      const req = route.request();
      const body = req.postDataJSON();
      seenImportPayload = body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entity_type: body.entity_type,
          target_schema: body.to_temp ? `uni_${universityId}_temp` : `uni_${universityId}`,
          strategy: body.strategy,
          imported: 1,
          updated: 0,
          skipped: 0,
          errors: [],
          total_processed: 1,
        }),
      });
    });

    // Find the first enabled Export button in the table (either From Temp or From Prod)
  const exportButtons = page.locator('table button:has-text("Export")');
  await expect(exportButtons.first()).toBeVisible({ timeout: 5000 });
  const count = await exportButtons.count();

    // Iterate to find an enabled one
    let clicked = false;
    let row: import('@playwright/test').Locator | null = null;
    for (let i = 0; i < count; i++) {
      const btn = exportButtons.nth(i);
      if (await btn.isEnabled()) {
        row = btn.locator('xpath=ancestor::tr[1]');
        // Set row strategy to Replace
        const rowSelect = row.locator('select').first();
        await rowSelect.selectOption('replace');
        await btn.click();
        clicked = true;
        // Click the import button in the same action group (the next button sibling)
        const siblingImport = btn.locator('xpath=following-sibling::button[contains(@class, "importButton")]').first();
        if (await siblingImport.isVisible()) {
          await siblingImport.click();
        } else {
          // Fallback: click any import button in the same row
          await row.locator('button:has-text("→")').first().click();
        }
        break;
      }
    }
  expect(clicked).toBeTruthy();

    // Wait a moment for fetch mocks to resolve
    await page.waitForTimeout(500);

    // Assert the import payload contains the selected strategy
    expect(seenImportPayload).not.toBeNull();
    expect(seenImportPayload.strategy).toBe('replace');
  });
});
