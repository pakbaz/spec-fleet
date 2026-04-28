import { test, expect } from '@playwright/test';

test('catalog renders products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
});
