import { Page } from '@playwright/test';
import { SELECTORS, TEST_CREDENTIALS, TIMEOUTS } from './constants';

/**
 * Login helper
 * @param page - Playwright page object
 * @param credentials - Optional credentials (defaults to ROOT)
 */
export async function login(
  page: Page,
  credentials = TEST_CREDENTIALS.ROOT
): Promise<void> {
  // Only go to login page if not already there
  if (!page.url().includes('http://localhost:3000')) {
    await page.goto('/');
  }
  
  // Wait for email input to be visible (confirms we're on login page)
  await page.waitForSelector(SELECTORS.LOGIN_EMAIL, { timeout: TIMEOUTS.MEDIUM });
  
  await page.fill(SELECTORS.LOGIN_EMAIL, credentials.email);
  await page.fill(SELECTORS.LOGIN_PASSWORD, credentials.password);
  await page.click(SELECTORS.LOGIN_SUBMIT);
  await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Ensure user is authenticated (handles auth state auto-redirect)
 * If already at dashboard, does nothing.
 * If at login, performs login.
 */
export async function ensureAuthenticated(
  page: Page,
  credentials = TEST_CREDENTIALS.ROOT
): Promise<void> {
  // Start by going to root if page is blank or not yet navigated
  if (!page.url() || page.url() === 'about:blank') {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Allow time for auth state redirect
    await page.waitForTimeout(TIMEOUTS.SHORT);
  }
  
  const currentUrl = page.url();
  
  // If already at dashboard or beyond, auth is valid
  if (currentUrl.includes('/dashboard') || 
      currentUrl.includes('/universities') ||
      currentUrl.includes('/university/')) {
    return;
  }
  
  // Check if on login page (email input visible)
  const emailInput = await page.locator(SELECTORS.LOGIN_EMAIL).count();
  if (emailInput > 0) {
    // We're on login page, perform login
    await page.fill(SELECTORS.LOGIN_EMAIL, credentials.email);
    await page.fill(SELECTORS.LOGIN_PASSWORD, credentials.password);
    await page.click(SELECTORS.LOGIN_SUBMIT);
    await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.NAVIGATION });
  }
  // Otherwise, assume we're already authenticated and wait for dashboard
  else {
    await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.NAVIGATION });
  }
}
