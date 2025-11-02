import { test, expect } from '@playwright/test';

const ENABLE = process.env.EPISTULA_E2E_ENABLE_UI_TESTS === '1';

// Requires existing university and faculty ids via env
const uniId = process.env.EPISTULA_E2E_UNI_ID || '1';
const facId = process.env.EPISTULA_E2E_FAC_ID || '1';

test.describe('Subjects create modal UI (optional)', () => {
  test.skip(!ENABLE, 'UI tests are optional and require EPISTULA_E2E_ENABLE_UI_TESTS=1');

  test('shows Markdown editor and logo input in create modal', async ({ page }) => {
    await page.goto(`/university/${uniId}/faculty/${facId}/subjects`);

    await expect(page.getByRole('button', { name: /Create New Subject/i })).toBeVisible();

    await page.getByRole('button', { name: /Create New Subject/i }).click();

    await expect(page.getByRole('heading', { name: /Create New Subject/i })).toBeVisible();

    await expect(page.getByText('Description (Markdown, optional)')).toBeVisible();

    // Markdown editor textarea should be present
    await expect(page.getByRole('textbox', { name: '' })).toBeVisible();

    const fileInputs = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInputs).toHaveCount(1);

    await expect(page.getByRole('button', { name: /Create Subject/i })).toBeVisible();
  });
});
