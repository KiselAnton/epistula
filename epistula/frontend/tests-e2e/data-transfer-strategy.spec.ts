import { test, expect } from '@playwright/test';

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
  // Test is self-contained; no dynamic university id needed

  test('row strategy select influences import payload', async ({ page, request: _request }) => {
    // Ensure origin before accessing localStorage
    await page.goto('/dashboard');
    const _token = await page.evaluate(() => localStorage.getItem('token'));

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const universityId = 1;

    // Mock temp-status before navigating to /backups
    await page.route(`${backendUrl}/api/v1/backups/${universityId}/temp-status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: universityId,
          university_name: 'Test University',
          has_temp_schema: true,
          temp_schema: `uni_${universityId}_temp`,
          production_schema: `uni_${universityId}`,
          temp_university_id: universityId,
          temp_info: { faculty_count: 1, user_count: 1 },
        }),
      });
    });

    // Mock /api/v1/backups/all to include a university with a temp schema
    await page.route(`${backendUrl}/api/v1/backups/all`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          universities: [
            {
              university_id: universityId,
              university_name: 'Test University',
              backups: [
                {
                  name: 'backup1.sql',
                  size_bytes: 123456,
                  created_at: new Date().toISOString(),
                  in_minio: false,
                  university_id: universityId,
                  university_name: 'Test University',
                },
              ],
            },
          ],
          total_backup_count: 1,
        }),
      });
    });

    // Mock entity counts endpoints to ensure Export buttons are enabled
    await page.route(`${backendUrl}/api/v1/data-transfer/${universityId}/entities?from_temp=true`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: universityId,
          schema_name: `uni_${universityId}_temp`,
          is_temp: true,
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
    await page.route(`${backendUrl}/api/v1/data-transfer/${universityId}/entities?from_temp=false`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: universityId,
          schema_name: `uni_${universityId}`,
          is_temp: false,
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

    // Navigate to Backups and expand panel
    await page.goto('/backups');
    await page.waitForTimeout(1000); // Increased wait for UI render

    // Debug: log all buttons with title="Expand section"
    const expandButtons = await page.locator('button[title="Expand section"]').all();
    console.log('Expand section buttons found:', expandButtons.length);

      // Expand the first university section (force expanded)
      const firstToggle = page.locator('button[title="Expand section"], button[aria-label="Expand"]').first();
      await expect(firstToggle).toBeVisible({ timeout: 10000 });
      await firstToggle.click();
      await page.waitForTimeout(500); // Wait for expansion

  // Wait for Temp Schema Active badge to confirm temp status is loaded
  await page.locator('text=Temp Schema Active').waitFor({ timeout: 10000 });

  // Debug: print all button texts after temp status
  const allButtons = await page.locator('button').allTextContents();
  console.log('All button texts after temp status:', allButtons);

  // Try to find the Data Transfer panel toggle by partial text
  const dataTransferToggle = page.locator('button', { hasText: /Data Transfer/ }).first();
  await expect(dataTransferToggle).toBeVisible({ timeout: 10000 });
  await dataTransferToggle.click();
  await page.waitForTimeout(500); // Wait for panel to open

    // Accept confirmation dialogs automatically
    page.on('dialog', (dialog) => dialog.accept());

    // Set up route mocks: capture export and import
    let seenImportPayload: any = null;

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
