import { test, expect } from '@playwright/test';

test.describe('Universities create modal UI', () => {
  test('shows Markdown editor and logo input in create modal', async ({ page }) => {
    await page.goto('/universities');

    await expect(page.getByRole('button', { name: /Register New University/i })).toBeVisible();

    await page.getByRole('button', { name: /Register New University/i }).click();

    await expect(page.getByRole('heading', { name: /Register New University/i })).toBeVisible();

    await expect(page.getByText('Description (Markdown, optional)')).toBeVisible();

    // Markdown editor should be present (implementation may vary; check for editable element or just proceed to file input)
    // Just verify we reached the create form successfully

  // Only the logo file input remains; the editor uses BlockNote with drag/paste uploads
  const fileInputs = page.locator('input[type="file"][accept*="image"]');
  await expect(fileInputs).toHaveCount(1);

  // Verify BlockNote editor presence via a contenteditable element
  await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();

    await expect(page.getByRole('button', { name: /Create University/i })).toBeVisible();
  });
});
