import { test, expect } from '@playwright/test';

// Basic smoke test to ensure app boots and is accessible
// With global setup, we're logged in, so we'll see dashboard or university page
test('app loads and is accessible', async ({ page }) => {
  await page.goto('/');
  // After login via global-setup, '/' redirects to dashboard or university page
  // Just confirm we get some Epistula UI (use first() to handle multiple matches)
  await expect(page.getByText(/Epistula/i).first()).toBeVisible();
});
