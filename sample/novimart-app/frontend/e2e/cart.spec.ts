import { test, expect } from '@playwright/test';

test('cart icon is visible from the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('cart-icon')).toBeVisible();
});
