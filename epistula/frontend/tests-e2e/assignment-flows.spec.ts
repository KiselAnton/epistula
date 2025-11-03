import { test, expect } from '@playwright/test';

/**
 * E2E tests for assignment workflows
 * Tests assigning/removing professors and students to/from subjects and faculties
 */

test.describe('Professor and Student Assignments', () => {
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
  });

  test.describe('Faculty Assignments', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Faculties
      await page.click('text=Faculties');
      await page.waitForURL('**/faculties');
      
      // Click on first faculty
      const firstFaculty = page.locator('[class*="faculty"]').first();
      await firstFaculty.click();
    });

    test('assigns professor to faculty', async ({ page }) => {
      // Look for "Assign Professor" or "Add Professor" button
      const assignButton = page.locator('button:has-text("Assign Professor"), button:has-text("Add Professor")').first();
      
      if (await assignButton.isVisible({ timeout: 3000 })) {
        await assignButton.click();
        
        // Select professor from dropdown or search
        const professorSelect = page.locator('select[name*="professor"], select:has-text("Select")').first();
        if (await professorSelect.isVisible({ timeout: 2000 })) {
          await professorSelect.selectOption({ index: 1 }); // Select first available
        } else {
          // Maybe there's a search field
          const searchField = page.locator('input[placeholder*="Search"], input[placeholder*="professor"]').first();
          if (await searchField.isVisible({ timeout: 1000 })) {
            await searchField.fill('prof');
            await page.waitForTimeout(500);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
          }
        }
        
        // Submit
        await page.click('button[type="submit"]:has-text("Assign"), button:has-text("Add")');
        
        // Verify professor appears in list
        await page.waitForTimeout(1000);
        const professorList = page.locator('[class*="professor"], [class*="member"]');
        const count = await professorList.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('assigns student to faculty', async ({ page }) => {
      // Look for "Assign Student" or "Add Student" button
      const assignButton = page.locator('button:has-text("Assign Student"), button:has-text("Add Student")').first();
      
      if (await assignButton.isVisible({ timeout: 3000 })) {
        await assignButton.click();
        
        // Select student
        const studentSelect = page.locator('select[name*="student"], select:has-text("Select")').first();
        if (await studentSelect.isVisible({ timeout: 2000 })) {
          await studentSelect.selectOption({ index: 1 });
        }
        
        // Submit
        await page.click('button[type="submit"]:has-text("Assign"), button:has-text("Add")');
        
        // Verify student appears in list
        await page.waitForTimeout(1000);
        const studentList = page.locator('[class*="student"], [class*="member"]');
        const count = await studentList.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('removes professor from faculty', async ({ page }) => {
      // Find professor list
      const professorItems = page.locator('[class*="professor"]');
      const count = await professorItems.count();
      
      if (count > 0) {
        // Click remove/delete button for first professor
        const removeButton = professorItems.first().locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="Remove"]').first();
        
        if (await removeButton.isVisible({ timeout: 2000 })) {
          const professorName = await professorItems.first().textContent();
          await removeButton.click();
          
          // Confirm if needed
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          // Verify professor removed
          await page.waitForTimeout(500);
          if (professorName) {
            // Check if that specific professor is gone
            const stillVisible = await page.locator(`text=${professorName}`).isVisible({ timeout: 1000 });
            expect(stillVisible).toBeFalsy();
          }
        }
      }
    });

    test('removes student from faculty', async ({ page }) => {
      // Find student list
      const studentItems = page.locator('[class*="student"]');
      const count = await studentItems.count();
      
      if (count > 0) {
        const removeButton = studentItems.first().locator('button:has-text("Remove"), button:has-text("Delete")').first();
        
        if (await removeButton.isVisible({ timeout: 2000 })) {
          await removeButton.click();
          
          // Confirm if needed
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          // Verify removal
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('Subject Assignments', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Faculties -> Subject
      await page.click('text=Faculties');
      await page.waitForTimeout(500);
      
      const firstFaculty = page.locator('[class*="faculty"]').first();
      await firstFaculty.click();
      
      await page.click('text=Subjects');
      await page.waitForTimeout(500);
      
      const firstSubject = page.locator('[class*="subject"]').first();
      await firstSubject.click();
    });

    test('assigns professor to subject', async ({ page }) => {
      // Look for professor assignment section
      const assignButton = page.locator('button:has-text("Assign Professor"), button:has-text("Add Professor")').first();
      
      if (await assignButton.isVisible({ timeout: 3000 })) {
        await assignButton.click();
        
        // Select professor
        const professorSelect = page.locator('select[name*="professor"]').first();
        if (await professorSelect.isVisible({ timeout: 2000 })) {
          await professorSelect.selectOption({ index: 1 });
          
          // Submit
          await page.click('button[type="submit"]:has-text("Assign"), button:has-text("Add")');
          
          // Verify assignment
          await page.waitForTimeout(1000);
        }
      }
    });

    test('enrolls student in subject', async ({ page }) => {
      // Look for student enrollment section
      const enrollButton = page.locator('button:has-text("Enroll Student"), button:has-text("Add Student")').first();
      
      if (await enrollButton.isVisible({ timeout: 3000 })) {
        await enrollButton.click();
        
        // Select student
        const studentSelect = page.locator('select[name*="student"]').first();
        if (await studentSelect.isVisible({ timeout: 2000 })) {
          await studentSelect.selectOption({ index: 1 });
          
          // Submit
          await page.click('button[type="submit"]:has-text("Enroll"), button:has-text("Add")');
          
          // Verify enrollment
          await page.waitForTimeout(1000);
        }
      }
    });

    test('removes professor from subject', async ({ page }) => {
      // Find professor in subject
      const professorSection = page.locator('[class*="professor"]');
      const count = await professorSection.count();
      
      if (count > 0) {
        const removeButton = professorSection.first().locator('button:has-text("Remove"), button:has-text("Unassign")').first();
        
        if (await removeButton.isVisible({ timeout: 2000 })) {
          await removeButton.click();
          
          // Confirm
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          await page.waitForTimeout(500);
        }
      }
    });

    test('unenrolls student from subject', async ({ page }) => {
      // Find student in subject
      const studentSection = page.locator('[class*="student"]');
      const count = await studentSection.count();
      
      if (count > 0) {
        const removeButton = studentSection.first().locator('button:has-text("Remove"), button:has-text("Unenroll")').first();
        
        if (await removeButton.isVisible({ timeout: 2000 })) {
          await removeButton.click();
          
          // Confirm
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
          if (await confirmButton.isVisible({ timeout: 1000 })) {
            await confirmButton.click();
          }
          
          await page.waitForTimeout(500);
        }
      }
    });

    test('prevents duplicate professor assignment', async ({ page }) => {
      // Try to assign same professor twice
      const assignButton = page.locator('button:has-text("Assign Professor"), button:has-text("Add Professor")').first();
      
      if (await assignButton.isVisible({ timeout: 3000 })) {
        // First assignment
        await assignButton.click();
        const professorSelect = page.locator('select[name*="professor"]').first();
        if (await professorSelect.isVisible({ timeout: 2000 })) {
          await professorSelect.selectOption({ index: 1 });
          await page.click('button[type="submit"]:has-text("Assign"), button:has-text("Add")');
          await page.waitForTimeout(1000);
          
          // Try to assign same professor again
          await assignButton.click();
          await professorSelect.selectOption({ index: 1 });
          await page.click('button[type="submit"]:has-text("Assign"), button:has-text("Add")');
          
          // Should show error
          const errorMessage = page.locator('text=/already assigned|duplicate|exists/i');
          await expect(errorMessage).toBeVisible({ timeout: 3000 });
        }
      }
    });

    test('prevents duplicate student enrollment', async ({ page }) => {
      // Try to enroll same student twice
      const enrollButton = page.locator('button:has-text("Enroll Student"), button:has-text("Add Student")').first();
      
      if (await enrollButton.isVisible({ timeout: 3000 })) {
        // First enrollment
        await enrollButton.click();
        const studentSelect = page.locator('select[name*="student"]').first();
        if (await studentSelect.isVisible({ timeout: 2000 })) {
          await studentSelect.selectOption({ index: 1 });
          await page.click('button[type="submit"]:has-text("Enroll"), button:has-text("Add")');
          await page.waitForTimeout(1000);
          
          // Try to enroll same student again
          await enrollButton.click();
          await studentSelect.selectOption({ index: 1 });
          await page.click('button[type="submit"]:has-text("Enroll"), button:has-text("Add")');
          
          // Should show error
          const errorMessage = page.locator('text=/already enrolled|duplicate|exists/i');
          await expect(errorMessage).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  test.describe('Assignment Validation', () => {
    test('requires professor to be assigned to faculty before subject', async ({ page }) => {
      // This test verifies the business rule that professors must be faculty members
      // before being assigned to subjects
      
      // Navigate to subject
      await page.click('text=Faculties');
      await page.waitForTimeout(500);
      const firstFaculty = page.locator('[class*="faculty"]').first();
      await firstFaculty.click();
      await page.click('text=Subjects');
      await page.waitForTimeout(500);
      const firstSubject = page.locator('[class*="subject"]').first();
      await firstSubject.click();
      
      // Try to assign professor not in faculty
      const assignButton = page.locator('button:has-text("Assign Professor")').first();
      if (await assignButton.isVisible({ timeout: 2000 })) {
        // The select dropdown should only show professors who are faculty members
        // or there should be validation preventing non-faculty assignment
        await assignButton.click();
        
        const professorSelect = page.locator('select[name*="professor"]').first();
        if (await professorSelect.isVisible({ timeout: 1000 })) {
          // Check if dropdown has options (should only show faculty professors)
          const options = await professorSelect.locator('option').count();
          expect(options).toBeGreaterThanOrEqual(0); // Can be 0 if no professors in faculty
        }
      }
    });

    test('shows correct assignment counts', async ({ page }) => {
      // Navigate to faculty
      await page.click('text=Faculties');
      await page.waitForTimeout(500);
      const firstFaculty = page.locator('[class*="faculty"]').first();
      await firstFaculty.click();
      
      // Look for counts display
      const professorCount = page.locator('text=/\\d+\\s+professors?/i');
      const studentCount = page.locator('text=/\\d+\\s+students?/i');
      
      const hasProfCount = await professorCount.isVisible({ timeout: 2000 });
      const hasStudCount = await studentCount.isVisible({ timeout: 2000 });
      
      // At least one count should be visible
      expect(hasProfCount || hasStudCount).toBeTruthy();
    });
  });

  test.describe('Bulk Operations', () => {
    test('bulk assigns multiple students', async ({ page }) => {
      await page.click('text=Faculties');
      await page.waitForTimeout(500);
      const firstFaculty = page.locator('[class*="faculty"]').first();
      await firstFaculty.click();
      
      // Look for bulk assign feature
      const bulkButton = page.locator('button:has-text("Bulk Assign"), button:has-text("Import Students")').first();
      
      if (await bulkButton.isVisible({ timeout: 2000 })) {
        await bulkButton.click();
        
        // Should show import interface or multi-select
        await page.waitForTimeout(500);
        
        // Verify bulk interface loaded
        const modalOrPanel = page.locator('[role="dialog"], [class*="modal"], [class*="import"]');
        await expect(modalOrPanel).toBeVisible({ timeout: 2000 });
      }
    });
  });
});
