import { test, expect } from '@playwright/test';

// Basic smoke test to ensure app boots and login page renders
// Assumes frontend dev server is running at baseURL

test('login page renders title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Epistula -- Login/i);
  await expect(page.getByText('Epistula')).toBeVisible();
});
