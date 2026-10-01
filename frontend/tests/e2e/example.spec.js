import { test, expect } from '@playwright/test';

test.describe('NourishSteps E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const body = path.includes('/month') ? { days: [] } : path.includes('summary7') ? { days: [], meals: {}, counts: {}, streak: 0 } : [];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    // Navigation smoke tests use fixture API responses, not a running backend.
    await page.goto('/');
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
    await page.getByRole('link', { name: 'Meal', exact: true }).click();
    await expect(page).toHaveURL(/.*meals/);
    await expect(page.getByRole('heading', { name: 'Meals', exact: true })).toBeVisible();
  });

  test('should navigate to Progress page', async ({ page }) => {
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(page).toHaveURL(/.*progress/);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true, level: 2 })).toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
    const before = await page.locator('html').getAttribute('data-theme');
    await themeButton.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', before);
  });
});

