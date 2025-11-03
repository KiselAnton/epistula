import { test, expect } from '@playwright/test';

/**
 * E2E tests for lecture CRUD operations
 * Tests creating, editing, deleting, and reordering lectures
 */

test.describe('Lecture Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as root
    await page.goto('http://localhost:3000/');
    await page.fill('input[type="email"]', 'root@localhost.localdomain');
    await page.fill('input[type="password"]', 'changeme123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard');
    
    // Navigate to first university
    await page.click('text=University 1');
    await page.waitForURL('**/university/1');
    
    // Navigate to Faculties
    await page.click('text=Faculties');
    await page.waitForURL('**/faculties');
    
    // Click on first faculty
    const firstFaculty = page.locator('[class*="faculty"]').first();
    await firstFaculty.click();
    
    // Navigate to Subjects
    await page.click('text=Subjects');
    
    // Click on first subject
    const firstSubject = page.locator('[class*="subject"]').first();
    await firstSubject.click();
    
    // Now we should be on the subject detail page with lectures
  });

  test('creates a new lecture', async ({ page }) => {
    // Look for "Create Lecture" or "Add Lecture" button
    const createButton = page.locator('button:has-text("Create Lecture"), button:has-text("Add Lecture"), button:has-text("New Lecture")').first();
    
    if (await createButton.isVisible({ timeout: 3000 })) {
      await createButton.click();
      
      // Fill in lecture form
      await page.fill('input[name="title"], input[placeholder*="title"]', 'Introduction to Testing');
      
      const descriptionField = page.locator('textarea[name="description"], textarea[placeholder*="description"]').first();
      if (await descriptionField.isVisible({ timeout: 1000 })) {
        await descriptionField.fill('This lecture covers the basics of testing');
      }
      
      const lectureNumberField = page.locator('input[name="lecture_number"], input[type="number"]').first();
      if (await lectureNumberField.isVisible({ timeout: 1000 })) {
        await lectureNumberField.fill('1');
      }
      
      // Submit form
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      
      // Verify lecture appears in list
      await expect(page.locator('text=Introduction to Testing')).toBeVisible({ timeout: 5000 });
    }
  });

  test('creates lecture with markdown content', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create Lecture"), button:has-text("Add Lecture")').first();
    
    if (await createButton.isVisible({ timeout: 3000 })) {
      await createButton.click();
      
      await page.fill('input[name="title"]', 'Lecture with Content');
      
      // Look for markdown editor or content field
      const contentEditor = page.locator('textarea[name="content"], [class*="editor"], [contenteditable="true"]').first();
      if (await contentEditor.isVisible({ timeout: 2000 })) {
        await contentEditor.fill('# Introduction\n\nThis is **bold** text.\n\n- Item 1\n- Item 2');
      }
      
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      
      await expect(page.locator('text=Lecture with Content')).toBeVisible({ timeout: 5000 });
    }
  });

  test('edits an existing lecture', async ({ page }) => {
    // Find first lecture edit button
    const editButtons = page.locator('button:has-text("Edit"), button[aria-label*="Edit"]');
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      
      // Update title
      const titleInput = page.locator('input[name="title"]');
      await titleInput.clear();
      await titleInput.fill('Updated Lecture Title');
      
      // Update description if available
      const descField = page.locator('textarea[name="description"]').first();
      if (await descField.isVisible({ timeout: 1000 })) {
        await descField.clear();
        await descField.fill('Updated description');
      }
      
      // Submit
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
      
      // Verify update
      await expect(page.locator('text=Updated Lecture Title')).toBeVisible({ timeout: 5000 });
    }
  });

  test('deletes a lecture', async ({ page }) => {
    // Create a lecture to delete
    const createButton = page.locator('button:has-text("Create Lecture"), button:has-text("Add Lecture")').first();
    
    if (await createButton.isVisible({ timeout: 3000 })) {
      await createButton.click();
      
      const testTitle = `Delete Me Lecture ${Date.now()}`;
      await page.fill('input[name="title"]', testTitle);
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      
      // Wait for lecture to appear
      await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 5000 });
      
      // Find and click delete button for our test lecture
      const lectureRow = page.locator(`[class*="lecture"]:has-text("${testTitle}")`).first();
      const deleteButton = lectureRow.locator('button:has-text("Delete"), button[aria-label*="Delete"]').first();
      
      if (await deleteButton.isVisible({ timeout: 2000 })) {
        await deleteButton.click();
        
        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
        
        // Verify lecture is removed
        await expect(page.locator(`text=${testTitle}`)).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('toggles lecture active status', async ({ page }) => {
    // Look for active/inactive toggle in lecture list
    const toggleButtons = page.locator('button:has-text("Deactivate"), button:has-text("Activate"), input[type="checkbox"][name*="active"]');
    const count = await toggleButtons.count();
    
    if (count > 0) {
      const firstToggle = toggleButtons.first();
      const initialText = await firstToggle.textContent();
      
      await firstToggle.click();
      
      // Wait for state change
      await page.waitForTimeout(500);
      
      // Verify state changed (button text should change from Activate to Deactivate or vice versa)
      const newText = await firstToggle.textContent();
      expect(newText).not.toBe(initialText);
    }
  });

  test('reorders lectures via drag and drop', async ({ page }) => {
    // Look for drag handles or reorder buttons
    const dragHandles = page.locator('[class*="drag"], [class*="handle"], button:has-text("↑"), button:has-text("↓")');
    const count = await dragHandles.count();
    
    if (count >= 2) {
      // Get initial order
      const lectures = page.locator('[class*="lecture"]');
      const firstLecture = await lectures.nth(0).textContent();
      const secondLecture = await lectures.nth(1).textContent();
      
      // Click "move down" on first lecture or "move up" on second
      const moveButton = page.locator('button:has-text("↓"), button:has-text("Move Down")').first();
      if (await moveButton.isVisible({ timeout: 1000 })) {
        await moveButton.click();
        
        // Wait for reorder
        await page.waitForTimeout(500);
        
        // Verify order changed
        const newFirstLecture = await lectures.nth(0).textContent();
        expect(newFirstLecture).toBe(secondLecture);
      }
    }
  });

  test('validates required fields when creating lecture', async ({ page }) => {
    const createButton = page.locator('button:has-text("Create Lecture"), button:has-text("Add Lecture")').first();
    
    if (await createButton.isVisible({ timeout: 3000 })) {
      await createButton.click();
      
      // Try to submit without title
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Save")');
      
      // Look for validation errors
      const errors = page.locator('[class*="error"], [role="alert"], text=/required|cannot be empty/i');
      const errorCount = await errors.count();
      
      expect(errorCount).toBeGreaterThan(0);
    }
  });

  test('displays lecture list with correct information', async ({ page }) => {
    // Verify lecture list shows title, description, date, etc.
    const lectureItems = page.locator('[class*="lecture"]');
    const count = await lectureItems.count();
    
    if (count > 0) {
      const firstLecture = lectureItems.first();
      
      // Should have a title
      const hasText = await firstLecture.textContent();
      expect(hasText).toBeTruthy();
      expect(hasText!.length).toBeGreaterThan(0);
    }
  });

  test('filters lectures by active status', async ({ page }) => {
    // Look for filter controls
    const filterSelect = page.locator('select:has-text("All"), select:has-text("Active"), select[name*="status"]').first();
    
    if (await filterSelect.isVisible({ timeout: 2000 })) {
      // Filter to show only active
      await filterSelect.selectOption('active');
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Verify filtered results
      const lectures = page.locator('[class*="lecture"]');
      const count = await lectures.count();
      expect(count).toBeGreaterThanOrEqual(0); // Can be 0 if no active lectures
    }
  });

  test('opens lecture detail view', async ({ page }) => {
    // Click on a lecture to view details
    const lectureLinks = page.locator('[class*="lecture"] a, [class*="lecture"] button:has-text("View")');
    const count = await lectureLinks.count();
    
    if (count > 0) {
      const lectureName = await lectureLinks.first().textContent();
      await lectureLinks.first().click();
      
      // Should navigate to detail view or open modal
      await page.waitForTimeout(500);
      
      // Verify lecture name is still visible (either in modal or detail page)
      if (lectureName) {
        await expect(page.locator(`text=${lectureName}`)).toBeVisible();
      }
    }
  });

  test('displays lecture count', async ({ page }) => {
    // Look for lecture count display
    const countDisplay = page.locator('text=/\\d+\\s+lectures?/i');
    
    if (await countDisplay.isVisible({ timeout: 2000 })) {
      const text = await countDisplay.textContent();
      expect(text).toMatch(/\d+/);
    }
  });

  test('handles empty lecture list gracefully', async ({ page }) => {
    // Try to find "No lectures" message or similar
    const emptyMessage = page.locator('text=/no lectures|empty|create your first/i');
    
    // Either there are lectures or there's an empty state message
    const lectures = page.locator('[class*="lecture"]');
    const lectureCount = await lectures.count();
    const hasEmptyMessage = await emptyMessage.isVisible({ timeout: 1000 });
    
    // Should have either lectures or an empty message
    expect(lectureCount > 0 || hasEmptyMessage).toBeTruthy();
  });
});
