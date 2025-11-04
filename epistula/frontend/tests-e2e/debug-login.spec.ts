import { test, expect } from '@playwright/test';

test('debug login page', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Take screenshot to see what's on the page
  await page.screenshot({ path: 'test-results/login-page-debug.png', fullPage: true });
  
  // Log the page title and URL
  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());
  
  // Log the page content
  const bodyHTML = await page.content();
  console.log('Page HTML length:', bodyHTML.length);
  
  // Check if we can find the login form
  const emailInput = page.locator('input[type="email"]');
  const isVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Email input visible:', isVisible);
  
  if (!isVisible) {
    console.log('Login form not found. Checking localStorage...');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    console.log('Token in localStorage:', token ? 'EXISTS' : 'null');
    console.log('User in localStorage:', user ? 'EXISTS' : 'null');
  }
});
