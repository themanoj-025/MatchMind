import { test, expect } from '@playwright/test';

test.describe('Draft Room', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the user is already registered or we can just go to the page and it will handle auth redirects
    // For a real e2e test we'd login here or use a stored state.
    // For simplicity, we just check if it redirects to login if unauthenticated.
    await page.goto('http://localhost:5173/lobby');
  });

  test('should require authentication to access the lobby', async ({ page }) => {
    // Should be redirected to /login if no valid token
    await expect(page).toHaveURL(/.*login/);
  });
});
