import { test, expect } from '@playwright/test';

test('reflection permissions, editable draft, confirmation and later intention', async ({ page }) => {
  let confirmations = 0;
  let savedTitle = '';
  await page.route('**/api/agent/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body = {};
    if (path.endsWith('/sessions')) {
      expect(request.postDataJSON()).toMatchObject({ history: false, notes: false });
      body = { id: 'demo', state: 'observing' };
    } else if (path.endsWith('/messages')) {
      body = { kind: 'draft', message: 'You can review this intention.', state: 'offering', sources: [], evidence: [], actions: [{ id: 'draft', kind: 'goal', payload: { title: 'Notice today' }, payload_hash: 'hash' }] };
    } else if (path.endsWith('/actions/draft')) {
      confirmations++;
      expect(request.postDataJSON().decision).toBe('confirm');
      savedTitle = request.postDataJSON().payload.title;
      body = { saved: true, id: 1 };
    } else if (path.endsWith('/goals')) body = { goals: savedTitle ? [{ id: 1, title: savedTitle, status: 'active' }] : [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/reflect');
  await expect(page.getByRole('heading', { name: 'Reflect, at your pace' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a reflection' }).click();
  await page.getByRole('textbox', { name: 'What would you like to reflect on?' }).fill('Please make an intention to notice today');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Review draft' })).toBeVisible();
  expect(confirmations).toBe(0);
  await page.getByRole('textbox', { name: 'Intention', exact: true }).fill('Ask a friend for company');
  await page.getByRole('button', { name: 'Save this version' }).click();
  await expect(page.getByText('Saved the version you confirmed.')).toBeVisible();
  expect(confirmations).toBe(1);
  await page.getByRole('button', { name: 'View my demo intentions' }).click();
  await expect(page.getByText('Ask a friend for company · active')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/reflection-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/reflection-mobile.png', fullPage: true });
});
