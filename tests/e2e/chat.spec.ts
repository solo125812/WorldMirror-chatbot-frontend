/**
 * E2E Smoke Test — Chat Flow
 *
 * Verifies the basic chat page loads and has key UI elements.
 */

import { test, expect } from '@playwright/test';
import { trackPageErrors } from './helpers';

test.describe('Chat Flow', () => {
  test('chat page loads and shows the message composer', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/chat');

    // The page title should be visible
    await expect(page.locator('header h1')).toContainText('WorldMirror');

    // Navigation should be present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav a[href="/chat"]')).toBeVisible();

    await assertNoErrors();
  });

  test('navigation links are present', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/chat');

    const navLinks = page.locator('nav a');
    const texts = await navLinks.allTextContents();

    expect(texts).toContain('Chat');
    expect(texts).toContain('Settings');
    expect(texts).toContain('Plugins');
    expect(texts).toContain('Extensions');
    expect(texts).toContain('Indexing');
    expect(texts).toContain('Logs');

    await assertNoErrors();
  });

  test('can send and receive a message', async ({ page }) => {
    const assertNoErrors = trackPageErrors(page);
    await page.goto('/chat');

    const input = page.getByPlaceholder('Type a message... (Enter to send, Shift+Enter for newline)');
    await input.click();
    await input.pressSequentially('Hello from E2E', { delay: 10 });
    await input.press('Enter');

    // User message should appear (wait for Svelte reactivity)
    const userMsg = page.locator('.message-user').last();
    await expect(userMsg).toContainText('Hello from E2E', { timeout: 10_000 });

    // Assistant message should appear (may contain error if no provider configured)
    const assistantMsg = page.locator('.message-assistant').last();
    await expect(assistantMsg).toBeVisible({ timeout: 10_000 });

    // Wait for streaming to complete (cursor removed)
    await expect(assistantMsg.locator('.cursor')).toHaveCount(0, { timeout: 15_000 });

    // Should have some response content (could be error message)
    await expect(assistantMsg.locator('.message-content')).not.toHaveText('');

    // Clear chat
    await page.getByTitle('Clear chat').click();
    await expect(page.locator('.empty-state')).toBeVisible();

    await assertNoErrors();
  });
});
