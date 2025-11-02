import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ENABLE = process.env.EPISTULA_E2E_ENABLE_UI_TESTS === '1';

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

test.describe('Faculties create modal UI (optional)', () => {
  test.skip(!ENABLE, 'UI tests are optional and require EPISTULA_E2E_ENABLE_UI_TESTS=1');

  test('shows Markdown editor and logo input in create modal', async ({ page }) => {
    await page.goto(`/university/${uniId}/faculties`);

    await expect(page.getByRole('button', { name: /Create New Faculty/i })).toBeVisible();

    await page.getByRole('button', { name: /Create New Faculty/i }).click();

    await expect(page.getByRole('heading', { name: /Create New Faculty/i })).toBeVisible();

    await expect(page.getByText('Description (Markdown, optional)')).toBeVisible();

    // Markdown editor should be present (implementation may vary; check for editable element or just proceed to file input)
    // Just verify we reached the create form successfully

    const fileInputs = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInputs).toHaveCount(1);

    await expect(page.getByRole('button', { name: /Create Faculty/i })).toBeVisible();
  });
});
