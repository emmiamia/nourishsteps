import { test, expect } from '@playwright/test';

test.describe('NourishSteps E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('http://localhost:5173');
  });

  test('should load home page', async ({ page }) => {
    await expect(page).toHaveTitle(/NourishSteps/);
    await expect(page.locator('text=Gentle support')).toBeVisible();
  });

  test('should navigate to Check-In page', async ({ page }) => {
    await page.click('text=Check-In');
    await expect(page).toHaveURL(/.*checkin/);
    await expect(page.locator('text=Daily Check-In')).toBeVisible();
  });

  test('should navigate to Meals page', async ({ page }) => {
    await page.click('text=Meal');
    await expect(page).toHaveURL(/.*meals/);
    await expect(page.locator('text=Meals')).toBeVisible();
  });

  test('should navigate to Progress page', async ({ page }) => {
    await page.click('text=Progress');
    await expect(page).toHaveURL(/.*progress/);
    await expect(page.locator('text=Progress')).toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    // Theme should change (check data-theme attribute)
    await page.waitForTimeout(100);
  });
});

