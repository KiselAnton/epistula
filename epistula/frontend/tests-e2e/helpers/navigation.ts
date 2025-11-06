import { Page } from '@playwright/test';
import { SELECTORS, TEST_DATA, TIMEOUTS, URL_PATTERNS } from './constants';

/**
 * Navigate to Universities list
 */
export async function navigateToUniversities(page: Page): Promise<void> {
  await page.click(SELECTORS.UNIVERSITIES_NAV);
  await page.waitForURL(URL_PATTERNS.UNIVERSITIES, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Navigate to a specific university detail page
 * @param page - Playwright page object
 * @param universityName - Optional name (defaults to E2E University)
 */
export async function navigateToUniversity(
  page: Page,
  universityName: string = TEST_DATA.E2E_UNIVERSITY_NAME
): Promise<void> {
  // Ensure we're on the universities page
  const currentUrl = page.url();
  if (!currentUrl.includes('/universities')) {
    await navigateToUniversities(page);
  }
  
  // Search for the university to filter the list (handles pagination)
  const searchBox = page.locator('input[placeholder*="Search"], input[aria-label*="Search"]');
  await searchBox.fill(universityName);
  await page.waitForTimeout(500); // Wait for search debounce
  
  // Click the university card by name
  await page.click(`${SELECTORS.UNIVERSITY_CARD}:has-text("${universityName}")`);
  await page.waitForURL(URL_PATTERNS.UNIVERSITY_DETAIL, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Navigate to Faculties list from university detail page
 */
export async function navigateToFaculties(page: Page): Promise<void> {
  // Ensure we're on a university detail page
  const currentUrl = page.url();
  if (!currentUrl.match(/\/university\/\d+$/)) {
    await navigateToUniversity(page);
  }
  
  // Click "Manage All" or "Manage Faculties" button
  await page.click(SELECTORS.MANAGE_FACULTIES_BTN);
  await page.waitForURL(URL_PATTERNS.FACULTIES, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Navigate to specific faculty detail page
 * @param page - Playwright page object
 * @param index - Optional index of faculty card to click (defaults to first/0)
 */
export async function navigateToFaculty(
  page: Page,
  index: number = 0
): Promise<void> {
  // Ensure we're on faculties list
  const currentUrl = page.url();
  if (!currentUrl.includes('/faculties')) {
    await navigateToFaculties(page);
  }
  
  // Wait for faculty cards to load (be resilient to delays)
  const noData = page.getByText(/No faculties found/i).first();
  await Promise.race([
    page.waitForSelector(SELECTORS.FACULTY_CARD, { timeout: TIMEOUTS.LONG }).catch(() => undefined),
    noData.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG }).catch(() => undefined),
  ]);
  // Small buffer to allow layout/hydration
  await page.waitForTimeout(200);
  
  // Click the faculty card by index
  const facultyCards = await page.locator(SELECTORS.FACULTY_CARD).all();
  if (facultyCards.length > index) {
    await facultyCards[index].click();
    await page.waitForURL(URL_PATTERNS.FACULTY_DETAIL, { timeout: TIMEOUTS.NAVIGATION });
  } else {
    // No faculties found - check if there's an empty state or create button
    const createFacultyBtn = page.locator('button:has-text("Create"), button:has-text("New Faculty")').first();
    const emptyState = page.locator('text=/no faculties/i').first();
    const hasCreate = await createFacultyBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (hasCreate || hasEmpty) {
      // Faculties list is empty but UI is functional - throw descriptive error
      throw new Error(`Faculty card at index ${index} not found (only ${facultyCards.length} cards available). Faculties list is empty.`);
    } else {
      throw new Error(`Faculty card at index ${index} not found (only ${facultyCards.length} cards available)`);
    }
  }
}

/**
 * Navigate to Subjects section within a faculty page
 * Note: Subjects are displayed directly on faculty detail page, no separate route
 */
export async function navigateToSubjects(page: Page): Promise<void> {
  // Ensure we're on a faculty detail page
  const currentUrl = page.url();
  if (!currentUrl.match(/\/faculty\/\d+$/)) {
    await navigateToFaculty(page);
  }
  
  // Subjects are shown directly on the faculty page
  // Just wait for them to load
  await page.waitForTimeout(TIMEOUTS.SHORT);
}

/**
 * Navigate to specific subject detail page
 * @param page - Playwright page object
 * @param index - Optional index of subject to click (defaults to first/0)
 */
export async function navigateToSubject(
  page: Page,
  index: number = 0
): Promise<void> {
  // Ensure we're on faculty detail page where subjects are listed
  const currentUrl = page.url();
  if (!currentUrl.match(/\/faculty\/\d+$/)) {
    await navigateToFaculty(page);
  }

  // Wait for the Subjects section heading to appear (increase timeout for slow renders)
  const subjectsHeading = page.locator('xpath=//h2[contains(normalize-space(.), "Subjects")]');
  await subjectsHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });

  // Find the grid of subject cards that follows the heading
  const subjectsGrid = page.locator(
    'xpath=//h2[contains(normalize-space(.), "Subjects")]/following::div[contains(@style, "display: grid")][1]'
  );
  await subjectsGrid.waitFor({ state: 'visible', timeout: TIMEOUTS.MEDIUM });

  // Prefer clicking the entire card container to ensure the onClick handler fires
  const subjectCards = subjectsGrid.locator('div:has(h3)');
  const count = await subjectCards.count();
  if (count === 0) {
    throw new Error('No subjects found in Subjects section. Ensure seed created a subject.');
  }
  if (index >= count) {
    throw new Error(`Subject at index ${index} not found (only ${count} subjects available)`);
  }

  await Promise.all([
    page.waitForURL(URL_PATTERNS.SUBJECT_DETAIL, { timeout: TIMEOUTS.NAVIGATION }),
    subjectCards.nth(index).click(),
  ]);

  // Extra safety: wait for a subject-detail unique element (allow longer timeout for nav)
  const backButton = page.locator('button:has-text("Back to Subjects"), button:has-text("My Notes"), a:has-text("Back")').first();
  await backButton.waitFor({ state: 'visible', timeout: TIMEOUTS.LONG });
}

/**
 * Navigate complete path from dashboard → university → faculty
 * @param universityName - Optional university name
 * @param facultyIndex - Optional faculty index
 */
export async function navigateToFacultyFromDashboard(
  page: Page,
  universityName: string = TEST_DATA.E2E_UNIVERSITY_NAME,
  facultyIndex: number = 0
): Promise<void> {
  await navigateToUniversity(page, universityName);
  await navigateToFaculty(page, facultyIndex);
}

/**
 * Navigate complete path from dashboard → university → faculty → subject
 * @param universityName - Optional university name
 * @param facultyIndex - Optional faculty index
 * @param subjectIndex - Optional subject index
 */
export async function navigateToSubjectFromDashboard(
  page: Page,
  universityName: string = TEST_DATA.E2E_UNIVERSITY_NAME,
  facultyIndex: number = 0,
  subjectIndex: number = 0
): Promise<void> {
  await navigateToUniversity(page, universityName);
  await navigateToFaculty(page, facultyIndex);
  await navigateToSubject(page, subjectIndex);
}
