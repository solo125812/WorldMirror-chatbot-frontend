/**
 * Integration tests — Extension and Indexer API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';
import { resetContainer } from '../../apps/server/src/di/container.js';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';

function initGitExtensionRepo() {
  const repoDir = mkdtempSync(join(tmpdir(), 'wm-ext-git-'));
  const manifest = {
    display_name: 'Git Extension',
    version: '1.0.0',
    description: 'Test git extension',
    author: 'Test',
  };

  writeFileSync(join(repoDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  execSync('git init', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: repoDir, stdio: 'pipe' });
  execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });

  const commit = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' }).toString().trim();
  const name = basename(repoDir);

  function bumpVersion(version: string) {
    const updated = { ...manifest, version };
    writeFileSync(join(repoDir, 'manifest.json'), JSON.stringify(updated, null, 2), 'utf-8');
    execSync('git add manifest.json', { cwd: repoDir, stdio: 'pipe' });
    execSync(`git commit -m "bump ${version}"`, { cwd: repoDir, stdio: 'pipe' });
    return execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' }).toString().trim();
  }

  return { repoDir, name, commit, bumpVersion };
}

function initArchiveExtension() {
  const dir = mkdtempSync(join(tmpdir(), 'wm-ext-zip-'));
  const manifest = {
    display_name: 'Archive Extension',
    version: '1.0.0',
    description: 'Test archive extension',
    author: 'Test',
  };

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  const zipPath = join(dir, 'archive-ext.zip');
  execSync(`zip -r "${zipPath}" manifest.json`, { cwd: dir, stdio: 'pipe' });
  const name = 'archive-ext';

  return { dir, zipPath, name };
}

describe('Extension API', () => {
  let app: FastifyInstance;
  const tempDirs: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
    for (const dir of tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('should list extensions (empty initially) via GET /extensions', async () => {
    const res = await app.inject({ method: 'GET', url: '/extensions' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should require url on install via POST /extensions/install', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/install',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('url');
  });

  it('should return 404 for missing extension via GET /extensions/:name', async () => {
    const res = await app.inject({ method: 'GET', url: '/extensions/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('should return 404 when uninstalling missing extension via DELETE /extensions/:name', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/extensions/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('should require name on update via POST /extensions/update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/update',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should require name on branches via POST /extensions/branches', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/branches',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should check for updates via POST /extensions/check-updates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/extensions/check-updates',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.updates).toEqual([]);
  });

  it('should install a git extension and update it', async () => {
    const repo = initGitExtensionRepo();
    tempDirs.push(repo.repoDir);

    const installRes = await app.inject({
      method: 'POST',
      url: '/extensions/install',
      payload: { url: repo.repoDir },
    });
    expect(installRes.statusCode).toBe(201);
    const installed = JSON.parse(installRes.payload);
    expect(installed.name).toBe(repo.name);
    expect(installed.source).toBe('git');
    expect(installed.repoUrl).toBe(repo.repoDir);
    const initialCommit = installed.commit;
    expect(initialCommit).toBe(repo.commit);

    const newCommit = repo.bumpVersion('1.0.1');
    const updateRes = await app.inject({
      method: 'POST',
      url: '/extensions/update',
      payload: { name: repo.name },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = JSON.parse(updateRes.payload);
    expect(updated.commit).toBe(newCommit);
    expect(updated.version).toBe('1.0.1');
  });

  it('should install an archive extension', async () => {
    const archive = initArchiveExtension();
    tempDirs.push(archive.dir);

    const res = await app.inject({
      method: 'POST',
      url: '/extensions/install',
      payload: { url: archive.zipPath, source: 'archive' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe(archive.name);
    expect(body.source).toBe('archive');
    expect(body.displayName).toBe('Archive Extension');
  });
});

describe('Indexer API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    resetContainer();
  });

  it('should report idle status via GET /indexer/status', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/status' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('idle');
    expect(body.jobId).toBeNull();
    expect(body.workspacePath).toBeNull();
    expect(body.progress).toBeNull();
  });

  it('should list jobs (empty initially) via GET /indexer/jobs', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/jobs' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('should require workspacePath on scan via POST /indexer/scan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/indexer/scan',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('workspacePath');
  });

  it('should require query on search via GET /indexer/search', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/search' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('query');
  });

  it('should stop returning false when no job running via POST /indexer/stop', async () => {
    const res = await app.inject({ method: 'POST', url: '/indexer/stop' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.stopped).toBe(false);
  });

  it('should return 404 for missing job via GET /indexer/jobs/:id', async () => {
    const res = await app.inject({ method: 'GET', url: '/indexer/jobs/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
