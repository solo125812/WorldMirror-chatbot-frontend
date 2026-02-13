import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@chatbot/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@chatbot/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@chatbot/utils': resolve(__dirname, 'packages/utils/src/index.ts'),
      '@chatbot/db': resolve(__dirname, 'packages/db/src/index.ts'),
      '@chatbot/storage': resolve(__dirname, 'packages/storage/src/index.ts'),
      '@chatbot/memory': resolve(__dirname, 'packages/memory/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'packages/*/src/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
