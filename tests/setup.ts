import { beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string | null = null;
let originalAppDataDir: string | undefined;

beforeAll(() => {
  originalAppDataDir = process.env.APP_DATA_DIR;
  tempDir = mkdtempSync(join(tmpdir(), 'worldmirror-config-'));
  process.env.APP_DATA_DIR = tempDir;
});

afterAll(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures in tests.
    }
  }

  if (originalAppDataDir === undefined) {
    delete process.env.APP_DATA_DIR;
  } else {
    process.env.APP_DATA_DIR = originalAppDataDir;
  }
});

