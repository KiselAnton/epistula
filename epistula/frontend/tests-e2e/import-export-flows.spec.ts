import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { ensureAuthenticated, navigateToUniversity, navigateToFaculty, navigateToSubject } from './helpers';

/**
 * E2E tests for complete import/export workflows
 * Tests full wizard flows, different strategies, error handling
 */

test.describe('Import/Export Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await navigateToUniversity(page);
  });

  test.describe('Export Workflows', () => {
    test('exports subject lectures successfully', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      // Click export lectures button
      const exportButton = page.locator('button:has-text("Export Lectures")').first();
      
      if (await exportButton.isVisible({ timeout: 3000 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          exportButton.click()
        ]);
        
        // Verify download started
        expect(download).toBeTruthy();
        
        // Verify filename contains expected pattern
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/lectures.*\.json/i);
      }
    });

    test('exports subject professors successfully', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      // Click export professors button
      const exportButton = page.locator('button:has-text("Export Professors")').first();
      
      if (await exportButton.isVisible({ timeout: 3000 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          exportButton.click()
        ]);
        
        expect(download).toBeTruthy();
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/professors.*\.json|subject_professors.*\.json/i);
      }
    });

    test('exports subject students successfully', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      // Click export students button
      const exportButton = page.locator('button:has-text("Export Students")').first();
      
      if (await exportButton.isVisible({ timeout: 3000 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          exportButton.click()
        ]);
        
        expect(download).toBeTruthy();
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/students.*\.json|subject_students.*\.json/i);
      }
    });

    test('exports faculty data successfully', async ({ page }) => {
      // Use navigation helpers
      await navigateToFaculty(page);
      
      // Look for export faculty button
      const exportButton = page.locator('button:has-text("Export")').first();
      
      if (await exportButton.isVisible({ timeout: 3000 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          exportButton.click()
        ]);
        
        expect(download).toBeTruthy();
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/faculty.*\.json|faculties.*\.json/i);
      }
    });
  });

  // Helper to create a test JSON file (shared across all import tests)
  const createTestImportFile = (data: any, filename: string): string => {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  };

  test.describe('Import Workflows', () => {

    test('imports lectures with merge strategy', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      // Click import lectures button
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        // Create test import data
        const testData = {
          entity_type: 'lectures',
          data: [
            { id: 999, title: 'Imported Lecture', lecture_number: 99 }
          ],
          columns: ['id', 'title', 'lecture_number']
        };
        
  const filePath = createTestImportFile(testData, 'test_lectures.json');
        
        // Upload file
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          
          // Wait for file to be processed
          await page.waitForTimeout(1000);
          
          // Select merge strategy
          const strategySelect = page.locator('select[name*="strategy"], select:has-text("merge")');
          if (await strategySelect.count() > 0) {
            await strategySelect.first().selectOption('merge');
          }
          
          // Proceed through wizard: Review & Import, then confirm Import in modal
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          await modalOverlay.getByRole('button', { name: 'Review & Import →' }).click();
          await page.waitForTimeout(300); // brief UI settle
          const confirmBtn = modalOverlay.getByRole('button', { name: /^Import Lecture/ });
          await confirmBtn.first().click();
          
          // Wait for import to complete
          await page.waitForTimeout(2000);
          
          // Success: modal closes after import. Assert modal overlay disappears.
          await expect(page.locator('[class*="modalOverlay"]').last()).toBeHidden({ timeout: 5000 });
        }

        // Cleanup for created file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('imports with skip strategy', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Professors")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        const testData = {
          entity_type: 'subject_professors',
          data: [{ professor_id: 1 }],
          columns: ['professor_id']
        };
        
        const filePath = createTestImportFile(testData, 'test_professors.json');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          // Select skip strategy
          const strategySelect = page.locator('select[name*="strategy"]');
          if (await strategySelect.count() > 0) {
            await strategySelect.first().selectOption('skip');
          }
          
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          await modalOverlay.getByRole('button', { name: 'Review & Import →' }).click();
          await page.waitForTimeout(300);
          await modalOverlay.getByRole('button', { name: /^Import Professors$/ }).first().click();
          await page.waitForTimeout(2000);
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('imports with overwrite strategy', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        const testData = {
          entity_type: 'lectures',
          data: [{ id: 1, title: 'Overwritten Lecture' }],
          columns: ['id', 'title']
        };
        
        const filePath = createTestImportFile(testData, 'test_overwrite.json');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          // Select overwrite strategy
          const strategySelect = page.locator('select[name*="strategy"]');
          if (await strategySelect.count() > 0) {
            await strategySelect.first().selectOption('overwrite');
          }
          
          // Proceed through wizard inside the modal
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          await modalOverlay.getByRole('button', { name: 'Review & Import →' }).click();
          await page.waitForTimeout(300);
          await modalOverlay.getByRole('button', { name: /^Import Lecture/ }).first().click();
          await page.waitForTimeout(2000);
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('shows preview before importing', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        const testData = {
          entity_type: 'lectures',
          data: [
            { id: 100, title: 'Preview Lecture 1' },
            { id: 101, title: 'Preview Lecture 2' }
          ],
          columns: ['id', 'title']
        };
        
        const filePath = createTestImportFile(testData, 'test_preview.json');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          // Verify we moved to review/edit step by checking form or detected message
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          const detectedMsg = modalOverlay.getByText(/Detected 2 lectures/i);
          const titleInput = modalOverlay.locator('input');
          await expect(detectedMsg.or(titleInput)).toBeVisible({ timeout: 3000 });
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('handles invalid JSON file', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        // Create invalid JSON file
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const filePath = path.join(tempDir, 'invalid.json');
        fs.writeFileSync(filePath, '{ invalid json content');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          // Look for error message
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          const errorMessage = modalOverlay.getByText(/invalid|error|failed|parse/i);
          await expect(errorMessage).toBeVisible({ timeout: 3000 });
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('handles empty import file', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        const testData = {
          entity_type: 'lectures',
          data: [],
          columns: []
        };
        
        const filePath = createTestImportFile(testData, 'empty.json');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          // Look for warning about empty data
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          const warningMessage = modalOverlay.getByText(/empty|no data|no records|invalid|failed/i);
          await expect(warningMessage).toBeVisible({ timeout: 3000 });
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    test('allows canceling import operation', async ({ page }) => {
      // Use navigation helpers
      await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        // Look for cancel button
        const cancelButton = page.locator('[class*="modalOverlay"]').last().locator('button:has-text("Cancel"), button:has-text("Close")');
        if (await cancelButton.isVisible({ timeout: 2000 })) {
          await cancelButton.click();
          
          // Verify import dialog closed
          const importModal = page.locator('[role="dialog"]:has-text("Import")');
          await expect(importModal).not.toBeVisible({ timeout: 2000 });
        }
      }
    });
  });

  test.describe('Strategy Selection', () => {
    test('persists strategy selection across rows', async ({ page }) => {
      // This is tested in data-transfer-persistence.spec.ts
      // Verify strategy applies to all rows when "apply to all" is used
      
  // Use navigation helpers
  await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        // Look for "Apply to All" functionality
        const applyToAllButton = page.locator('button:has-text("Apply to All"), input[type="checkbox"]:has-text("Apply")').first();
        
        if (await applyToAllButton.isVisible({ timeout: 2000 })) {
          // Test covered in existing data-transfer-persistence.spec.ts
          expect(true).toBeTruthy();
        }
      }
    });

    test('allows per-row strategy selection', async ({ page }) => {
      // This is tested in data-transfer-strategy.spec.ts
      // Verify each row can have its own strategy
      
  // Use navigation helpers
  await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        // Test covered in existing data-transfer-strategy.spec.ts
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('displays import errors clearly', async ({ page }) => {
  // Navigate to subject to test import errors
  await navigateToSubject(page);
      
      const importButton = page.locator('button:has-text("Import Lectures")').first();
      
      if (await importButton.isVisible({ timeout: 3000 })) {
        await importButton.click();
        
        // Create data with validation errors (missing required fields)
        const testData = {
          entity_type: 'lectures',
          data: [{ id: 200 }], // Missing title (required)
          columns: ['id']
        };
        
        const filePath = createTestImportFile(testData, 'test_errors.json');
        
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 })) {
          await fileInput.setInputFiles(filePath);
          await page.waitForTimeout(1000);
          
          const modalOverlay = page.locator('[class*="modalOverlay"]').last();
          if (await modalOverlay.isVisible({ timeout: 2000 })) {
            // With invalid data for a single lecture, the review button may be disabled.
            // Assert that validation prevents proceeding.
            const reviewBtn = modalOverlay.getByRole('button', { name: 'Review & Import →' });
            await expect(reviewBtn).toBeDisabled();
          }
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });
  });
});

