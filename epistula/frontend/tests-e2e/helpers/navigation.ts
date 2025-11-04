import { Page, expect } from '@playwright/test';
import { SELECTORS, TEST_DATA, TIMEOUTS, URL_PATTERNS } from './constants';

/**
 * Navigate to Universities list
 */
export async function navigateToUniversities(page: Page): Promise<void> {
  await page.click(SELECTORS.UNIVERSITIES_NAV);
  await page.waitForURL(URL_PATTERNS.UNIVERSITIES, { timeout: TIMEOUTS.NAVIGATION });
}

/**
 * Navigate to specific university or the E2E test university
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
  
  // Wait for faculty cards to load
  await page.waitForSelector(SELECTORS.FACULTY_CARD, { timeout: TIMEOUTS.MEDIUM });
  
  // Click the faculty card by index
  const facultyCards = await page.locator(SELECTORS.FACULTY_CARD).all();
  if (facultyCards.length > index) {
    await facultyCards[index].click();
    await page.waitForURL(URL_PATTERNS.FACULTY_DETAIL, { timeout: TIMEOUTS.NAVIGATION });
  } else {
    throw new Error(`Faculty card at index ${index} not found (only ${facultyCards.length} cards available)`);
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
  
  // Wait for page content to load
  try {
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.LONG });
  } catch {
    // Network might not be idle, but content may be ready anyway
    await page.waitForTimeout(TIMEOUTS.DEFAULT);
  }
  
  // Subjects section has an h2 with text starting with "Subjects"
  // Wait for that header to be visible to confirm subjects section loaded
  await page.waitForSelector('h2', { state: 'visible', timeout: TIMEOUTS.NAVIGATION });
  await page.waitForTimeout(TIMEOUTS.SHORT); // Give subjects grid time to render
  
  // Subject cards are clickable divs in a grid. Each has an h3 with the subject name.
  // Get all h3 elements and filter to find subject names
  const allH3s = await page.locator('h3').all();
  const subjectH3s: typeof allH3s = [];
  
  for (const h3 of allH3s) {
    const text = await h3.textContent();
    // Skip headings: "Subjects", "Professors", "Students", etc.
    // Subject names are usually simple text without these keywords
    if (text && !text.includes('Subjects') && !text.includes('Professor') && !text.includes('Student') && !text.includes('Members') && text.length > 2) {
      subjectH3s.push(h3);
    }
  }
  
  if (subjectH3s.length > index) {
    // The h3 is nested inside divs. Find the clickable card div by going up to a div with cursor:pointer style
    const targetH3 = subjectH3s[index];
    // Get the text to confirm which subject we're clicking
    const subjectName = await targetH3.textContent();
    
    // Find the clickable parent div - it should have style containing "cursor: pointer"
    // Use a more reliable method: click the h3 itself, as the click should bubble up to the parent onClick
    await targetH3.click({ force: true });
    await page.waitForURL(URL_PATTERNS.SUBJECT_DETAIL, { timeout: TIMEOUTS.NAVIGATION });
  } else {
    throw new Error(`Subject at index ${index} not found (only ${subjectH3s.length} subjects available). Check if subjects exist in test data.`);
  }
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
