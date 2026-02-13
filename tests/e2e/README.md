# E2E Tests

End-to-end tests using [Playwright](https://playwright.dev/).

## Setup

```bash
# Install Playwright and browsers
cd chatbot-frontend
pnpm install
npx playwright install chromium
```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run specific test file
npx playwright test tests/e2e/chat.spec.ts
```

## Test Files

| File | Coverage |
|------|----------|
| `chat.spec.ts` | Chat page load, navigation links |
| `plugins.spec.ts` | Plugins page load, empty state |
| `extensions-indexing.spec.ts` | Extensions install form, indexing page elements |

## Configuration

See [`playwright.config.ts`](../../playwright.config.ts) in the workspace root.

Tests automatically start the server (`apps/server`) and web app (`apps/web`) before running.

## Writing Tests

- Use `test.describe()` for grouping related tests
- Use `page.goto('/route')` to navigate
- Use `page.locator()` with CSS selectors or text content
- Use `expect()` for assertions
- Tests run in Chromium by default
