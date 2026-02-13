/**
 * E2E Smoke Test — Extensions & Indexing Pages
 *
 * Verifies extensions and indexing management pages load and render.
 */

import { test, expect, request, type APIRequestContext } from '@playwright/test';
import { trackPageErrors } from './helpers';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3001';

function initGitExtensionRepo() {
  const repoDir = mkdtempSync(join(tmpdir(), 'wm-e2e-ext-'));
  const manifest = {
    display_name: 'E2E Extension',
    version: '1.0.0',
    description: 'E2E test extension',
    author: 'E2E',
  };

  writeFileSync(join(repoDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  execSync('git init', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "e2e@example.com"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "E2E User"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });

  return { repoDir, name: basename(repoDir), displayName: manifest.display_name };
}

test.describe('Extensions Management', () => {
  let api: APIRequestContext;
  let repo: ReturnType<typeof initGitExtensionRepo>;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: API_BASE });
    repo = initGitExtensionRepo();
  });

  test.afterAll(async () => {
    try {
      await api.delete(`/extensions/${repo.name}`);
    } catch {
      // ignore cleanup errors
    }
    await api.dispose();
    try {
      rmSync(repo.repoDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test('extensions page loads and shows heading', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/extensions');

    await expect(page.locator('h2')).toContainText('Extensions');
    await assertNoErrors();
  });

  test('extensions page has install button', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/extensions');

    // Should have an install button
    const installBtn = page.locator('button', { hasText: 'Install Extension' });
    await expect(installBtn).toBeVisible();
    await assertNoErrors();
  });

  test('extensions install form toggles', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/extensions');

    // Wait for the page to finish loading
    await page.waitForTimeout(500);

    const installBtn = page.locator('button', { hasText: 'Install Extension' });
    await expect(installBtn).toBeVisible({ timeout: 10_000 });
    await installBtn.click();

    // Install form should now be visible
    const urlInput = page.locator('#install-url');
    await expect(urlInput).toBeVisible({ timeout: 5_000 });

    // Click Cancel to hide form — the button text changed to 'Cancel'
    const cancelBtn = page.locator('button', { hasText: 'Cancel' });
    await cancelBtn.click();
    await expect(urlInput).not.toBeVisible();
    await assertNoErrors();
  });

  test('installs and uninstalls a git extension via UI', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/extensions');

    // Wait for the page to finish loading
    await page.waitForTimeout(500);

    const toggleBtn = page.getByRole('button', { name: /Install Extension/i });
    await expect(toggleBtn).toBeVisible({ timeout: 10_000 });
    await toggleBtn.click();

    const urlField = page.getByLabel('Repository URL or Archive URL');
    await expect(urlField).toBeVisible({ timeout: 5_000 });
    await urlField.fill(repo.repoDir);
    await page.getByRole('button', { name: 'Install' }).click();

    const extCard = page.locator('.ext-card', { hasText: repo.displayName });
    await expect(extCard).toBeVisible({ timeout: 10_000 });

    // Toggle enable/disable
    const enableBtn = extCard.getByRole('button', { name: /Enable|Disable/ });
    await enableBtn.click();
    await expect(extCard.locator('.status-badge')).toContainText(/Active|Disabled/);

    // Uninstall
    page.once('dialog', (dialog) => dialog.accept());
    await extCard.getByRole('button', { name: 'Uninstall' }).click();
    await expect(extCard).toHaveCount(0, { timeout: 10_000 });

    await assertNoErrors();
  });
});

test.describe('Indexing Management', () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'wm-e2e-workspace-'));

  test.beforeAll(() => {
    const srcDir = join(workspaceDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'sample.ts'), 'export const hello = "world";', 'utf-8');
  });

  test.afterAll(() => {
    try {
      rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test('indexing page loads and shows heading', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/indexing');

    await expect(page.locator('h2')).toContainText('Code Indexing');
    await assertNoErrors();
  });

  test('indexing page shows workspace path input', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/indexing');

    const pathInput = page.locator('#workspace-path');
    await expect(pathInput).toBeVisible();
    await assertNoErrors();
  });

  test('indexing page has start button', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/indexing');

    const startBtn = page.locator('button', { hasText: 'Start Indexing' });
    await expect(startBtn).toBeVisible();
    await assertNoErrors();
  });

  test('can start indexing and see completed job', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/indexing');

    // Wait for page to fully load
    const pathInput = page.getByLabel('Workspace Path');
    await expect(pathInput).toBeVisible({ timeout: 10_000 });

    await pathInput.fill(workspaceDir);
    await page.getByRole('button', { name: /Start Indexing/ }).click();

    const jobCard = page.locator('.job-card', { hasText: workspaceDir });
    await expect(jobCard).toBeVisible({ timeout: 15_000 });
    await expect(jobCard.locator('.job-status')).toContainText('completed', { timeout: 20_000 });

    await assertNoErrors();
  });
});
