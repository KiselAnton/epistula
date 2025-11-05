import { test } from '@playwright/test';

test('detailed login page inspection', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  
  // Wait a bit for any client-side rendering
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/login-detailed.png', fullPage: true });
  
  // Check for all possible login field selectors
  const selectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="Email" i]',
    'form input[type="text"]',
    'input',
  ];
  
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    console.log(`Selector "${selector}": ${count} elements found`);
    if (count > 0) {
      const first = page.locator(selector).first();
      const isVis = await first.isVisible().catch(() => false);
      console.log(`  First element visible: ${isVis}`);
    }
  }
  
  // Get body text to see if there's an error message
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 500));
  
  // Check if page has finished loading
  const readyState = await page.evaluate(() => document.readyState);
  console.log('Document ready state:', readyState);
});
