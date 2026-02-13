/**
 * E2E Smoke Test — Plugins Page
 *
 * Verifies the plugins management page loads and renders.
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { trackPageErrors } from './helpers';

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3001';
const pluginId = `e2e-plugin-${Date.now()}`;
const pluginName = 'E2E Plugin';
let api: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: API_BASE });
  const install = await api.post('/plugins/install', {
    data: {
      manifest: {
        id: pluginId,
        name: pluginName,
        version: '1.0.0',
        description: 'E2E plugin install',
        entry: 'index.ts',
        permissions: ['network'],
      },
    },
  });
  expect(install.status()).toBe(201);
});

test.afterAll(async () => {
  if (api) {
    await api.delete(`/plugins/${pluginId}`);
    await api.dispose();
  }
});

test.describe('Plugins Management', () => {
  test('plugins page loads and shows heading', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/plugins');

    await expect(page.locator('h2')).toContainText('Plugins');
    await assertNoErrors();
  });

  test('plugins page shows installed plugin and allows toggling', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/plugins');

    // Wait for plugin list to load
    const pluginCard = page.locator('.plugin-card', { hasText: pluginName });
    await expect(pluginCard).toBeVisible({ timeout: 10_000 });

    // Toggle enable/disable
    const toggleBtn = pluginCard.getByRole('button', { name: /Enable|Disable/ });
    await toggleBtn.click();
    await expect(pluginCard.locator('.status-badge')).toContainText(/Active|Disabled/);

    await assertNoErrors();
  });
});
