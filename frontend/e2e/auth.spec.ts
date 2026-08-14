import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Fill in credentials
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to lobby
    await expect(page).toHaveURL('http://localhost:5173/lobby');
    await expect(page.locator('text=Lobby')).toBeVisible();
  });

  test('should allow a user to register', async ({ page }) => {
    await page.goto('http://localhost:5173/register');

    const randomStr = Math.random().toString(36).substring(7);
    const email = `testuser_${randomStr}@example.com`;

    // Fill in registration details
    await page.fill('input[placeholder="Username"]', `testuser_${randomStr}`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Expect navigation to lobby on success
    await expect(page).toHaveURL('http://localhost:5173/lobby');
  });
});
