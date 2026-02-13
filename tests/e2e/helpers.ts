import { expect, type Page } from '@playwright/test';

export function trackPageErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[console] ${msg.text()}`);
    }
  });

  return async () => {
    expect(errors, `Console or page errors detected:\n${errors.join('\n')}`).toEqual([]);
  };
}

