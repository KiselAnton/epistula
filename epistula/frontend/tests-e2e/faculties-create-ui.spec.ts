import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Prefer IDs seeded by global setup; fallback to env, then '1'
function getIds() {
  try {
    const p = path.join(process.cwd(), 'tests-e2e', '.auth', 'ids.json');
    const raw = fs.readFileSync(p, 'utf-8');
    const j = JSON.parse(raw);
    return j as { universityId?: number };
  } catch {
    return {} as any;
  }
}
const seeded = getIds();
const uniId = String(process.env.EPISTULA_E2E_UNI_ID || seeded.universityId || '1');

test.describe('Faculties create modal UI', () => {
  test('shows Markdown editor and logo input in create modal', async ({ page }) => {
    // Navigate directly but ensure page is fully loaded before assertions
    await page.goto(`/university/${uniId}/faculties`);
    
    // Wait for the Faculties header to appear (page finished loading)
    const header = page.locator('h1:has-text("Faculties")');
    await header.waitFor({ state: 'visible', timeout: 10000 });

    await expect(page.getByRole('button', { name: /Create New Faculty/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Create New Faculty/i }).click();

    await expect(page.getByRole('heading', { name: /Create New Faculty/i })).toBeVisible();

    await expect(page.getByText('Description (Markdown, optional)')).toBeVisible();

    // Markdown editor should be present (implementation may vary; check for editable element or just proceed to file input)
    // Just verify we reached the create form successfully

  const fileInputs = page.locator('input[type="file"][accept*="image"]');
  await expect(fileInputs).toHaveCount(1); // only the logo input remains; editor is BlockNote

  // Verify BlockNote editor presence via a contenteditable element
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();

    await expect(page.getByRole('button', { name: /Create Faculty/i })).toBeVisible();
  });
});
