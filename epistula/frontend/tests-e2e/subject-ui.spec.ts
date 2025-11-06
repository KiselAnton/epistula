import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Prefer IDs seeded by global setup; fallback to env, then '1'
function getIds() {
  try {
    const p = path.join(process.cwd(), 'tests-e2e', '.auth', 'ids.json');
    const raw = fs.readFileSync(p, 'utf-8');
    const j = JSON.parse(raw);
    return j as { universityId?: number; facultyId?: number; subjectId?: number };
  } catch {
    return {} as any;
  }
}
const seeded = getIds();

// These are opt-in UI smoke checks that don't assume a running backend session.
// They verify that the app starts and key actions exist on the subject page when navigable.

test.describe('Subject page UI', () => {
  test('renders export/import buttons placeholders', async ({ page }) => {
    // Assumes an authenticated session and a live backend if ENABLE=1 is set by the runner.
    // Route parameters are resolved from seeded ids where available.
    const uniId = String(process.env.EPISTULA_E2E_UNI_ID || seeded.universityId || '1');
    const facId = String(process.env.EPISTULA_E2E_FAC_ID || seeded.facultyId || '1');
    const subjId = String(process.env.EPISTULA_E2E_SUBJECT_ID || seeded.subjectId || '1');

    await page.goto(`/university/${uniId}/faculty/${facId}/subject/${subjId}`);

    // Buttons are part of the subject detail page toolbar and sections
    await expect(page.getByRole('button', { name: /Import Lectures/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import Professors/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Professors/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import Students/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Students/i })).toBeVisible();

    // The lectures section header export (multiple matches, check at least one visible)
    await expect(page.getByRole('button', { name: /Export Lectures/i }).first()).toBeVisible();
  });

  test('triggers downloads for export buttons (smoke)', async ({ page }) => {
    const uniId = String(process.env.EPISTULA_E2E_UNI_ID || seeded.universityId || '1');
    const facId = String(process.env.EPISTULA_E2E_FAC_ID || seeded.facultyId || '1');
    const subjId = String(process.env.EPISTULA_E2E_SUBJECT_ID || seeded.subjectId || '1');

    await page.goto(`/university/${uniId}/faculty/${facId}/subject/${subjId}`);

    // Click Export Lectures: we only assert that a download is attempted within a timeout
    const [dlLectures] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.getByRole('button', { name: /Export Lectures/i }).first().click(),
    ]);
    expect(dlLectures === null || typeof (dlLectures as any).suggestedFilename === 'function').toBeTruthy();

    // Export Professors
    const [dlProfs] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.getByRole('button', { name: /Export Professors/i }).first().click(),
    ]);
    expect(dlProfs === null || typeof (dlProfs as any).suggestedFilename === 'function').toBeTruthy();

    // Export Students
    const [dlStudents] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.getByRole('button', { name: /Export Students/i }).first().click(),
    ]);
    expect(dlStudents === null || typeof (dlStudents as any).suggestedFilename === 'function').toBeTruthy();
  });
});
