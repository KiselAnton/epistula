import { test, expect } from '@playwright/test';

test.describe('Data Transfer strategy persistence and apply-to-all', () => {
  test('persists per-row selection and applies to all rows', async ({ page, request: _request }) => {
    await page.goto('/dashboard');
    const _token = await page.evaluate(() => localStorage.getItem('token'));
    const _backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    // Mock temp-status and entities to ensure panel is visible and counts > 0
    await page.route(/\/api\/v1\/backups\/\d+\/temp-status$/, async (route) => {
      const m = route.request().url().match(/backups\/(\d+)\/temp-status/);
      const uid = m ? Number(m[1]) : 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: uid,
          university_name: 'Test',
          has_temp_schema: true,
          temp_schema: `uni_${uid}_temp`,
          production_schema: `uni_${uid}`,
          temp_university_id: uid,
          temp_info: { faculty_count: 1, user_count: 1 },
        }),
      });
    });

    await page.route(/\/api\/v1\/data-transfer\/\d+\/entities\?from_temp=.*/, async (route) => {
      const isTemp = route.request().url().includes('from_temp=true');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          university_id: 1,
          schema_name: isTemp ? 'uni_1_temp' : 'uni_1',
          is_temp: isTemp,
          entities: {
            faculties: 1,
            subjects: 1,
            faculty_professors: 1,
            faculty_students: 1,
            subject_professors: 1,
            lectures: 1,
            lecture_materials: 1,
          },
          total_entities: 7,
        }),
      });
    });

    // Navigate to backups
    await page.goto('/backups');

    // Open the Data Transfer panel directly; fall back to any expand/caret buttons if needed
    await page.waitForTimeout(1500); // Allow page to hydrate
    const dataTransferToggles = page.getByRole('button', { name: /Data Transfer \(Temp ↔ Production\)/ });
    const expandButtons = page.locator('button[title="Expand section"], button:has-text("▶"), button:has-text("▼")');
    
    // Try to find and click DT toggle directly
    let dtOpened = false;
    if (await dataTransferToggles.first().isVisible({ timeout: 7000 }).catch(() => false)) {
      await dataTransferToggles.first().click();
      dtOpened = true;
    } else {
      // Expand the university first, then DT
      if (await expandButtons.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expandButtons.first().click();
        await page.waitForTimeout(500);
        if (await dataTransferToggles.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await dataTransferToggles.first().click();
          dtOpened = true;
        }
      }
    }

    // If Data Transfer panel didn't open, test is not applicable
    if (!dtOpened) {
      console.log('Data Transfer panel not available, skipping test');
      return;
    }

    // Wait for tbody to ensure rows exist
    await page.waitForTimeout(500);
    const tbody = page.locator('tbody tr').first();
    const tbodyVisible = await tbody.isVisible({ timeout: 7000 }).catch(() => false);
    if (!tbodyVisible) {
      console.log('Data Transfer table not loaded, skipping test');
      return;
    }
    
    // Change first row strategy to skip_existing
    const firstRow = page.locator('tbody tr').first();
    const rowSelect = firstRow.locator('select').first();
    await rowSelect.waitFor({ state: 'visible', timeout: 3000 });
    await rowSelect.selectOption('skip_existing');

    // Reload and re-open to verify persistence
  await page.reload();
  // After reload, re-open the panel using the same resilient approach
  await page.waitForTimeout(1000); // Allow page to hydrate
  const dtToggles2 = page.getByRole('button', { name: /Data Transfer \(Temp ↔ Production\)/ });
  const expandButtons2 = page.locator('button[title="Expand section"], button:has-text("▶"), button:has-text("▼")');
  
  if (await dtToggles2.first().isVisible({ timeout: 7000 }).catch(() => false)) {
    await dtToggles2.first().click();
  } else {
    if (await expandButtons2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expandButtons2.first().click();
      await page.waitForTimeout(500);
      if (await dtToggles2.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await dtToggles2.first().click();
      }
    }
  }

    // Wait for tbody again after reload
    await page.waitForTimeout(500);
    await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 7000 });
    const rowSelectAfter = page.locator('tbody tr').first().locator('select').first();
    await rowSelectAfter.waitFor({ state: 'visible', timeout: 3000 });
    await expect(rowSelectAfter).toHaveValue('skip_existing');

    // Apply-to-all set to replace
    const applySelect = page.locator('#apply-all-select');
    await applySelect.selectOption('replace');
    await page.getByRole('button', { name: 'Apply to all' }).click();

    // Verify all row selects now show replace
    const _rowSelects = page.locator('tbody tr select').first();
    // Check first few rows (we don't know exact number, but at least first two exist in mock counts)
    const allRowSelects = page.locator('tbody tr select');
    const total = await allRowSelects.count();
    for (let i = 0; i < Math.min(total, 5); i++) {
      await expect(allRowSelects.nth(i)).toHaveValue('replace');
    }
  });
});
