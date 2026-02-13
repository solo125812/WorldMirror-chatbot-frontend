/**
 * E2E Smoke Test — Logs Page
 */

import { test, expect } from '@playwright/test';
import { trackPageErrors } from './helpers';

test.describe('Logs Viewer', () => {
  test('logs page loads and shows diagnostics controls', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/logs');

    await expect(page.locator('h2')).toContainText('Log Viewer');

    // Stats bar should render counts
    await expect(page.locator('.stats-bar')).toBeVisible();

    // Export diagnostics link should be present
    const exportLink = page.getByRole('link', { name: /Export Diagnostics/i });
    await expect(exportLink).toBeVisible();
    await expect(exportLink).toHaveAttribute('href', /diagnostics\/download/);

    // Filters should be present
    await expect(page.getByLabel('Level')).toBeVisible();
    await expect(page.getByLabel('Subsystem')).toBeVisible();
    await expect(page.getByLabel('Limit')).toBeVisible();

    await assertNoErrors();
  });

  test('can change log level filter and refresh', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/logs');

    await page.getByLabel('Level').selectOption('error');
    await page.getByRole('button', { name: '🔄 Refresh' }).click();

    const table = page.locator('.log-table');
    const empty = page.locator('.empty-state');
    const hasTable = await table.isVisible().catch(() => false);
    const hasEmpty = await empty.isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);

    await assertNoErrors();
  });
});
