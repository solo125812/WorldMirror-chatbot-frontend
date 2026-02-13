/**
 * Extension Manager — §12.1-12.4
 *
 * Manages extension installation, updates, and removal.
 * Supports git-based and archive-based installs.
 */

import type { InstalledExtension, ExtensionManifest, ExtensionScope, ExtensionSource, UpdateCheckResult } from '@chatbot/types';
import type { ExtensionRepo } from '@chatbot/db';
import { safeValidateExtensionManifest } from './manifest.js';
import { logger } from '@chatbot/utils';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';

export interface ExtensionManagerConfig {
  extensionsDir: string;
}

/**
 * ExtensionManager handles install, update, and removal of UI extensions.
 */
export class ExtensionManager {
  private extensionsDir: string;

  constructor(
    private extensionRepo: ExtensionRepo,
    config: ExtensionManagerConfig,
  ) {
    this.extensionsDir = config.extensionsDir;
    // Ensure extensions directory exists
    if (!existsSync(this.extensionsDir)) {
      mkdirSync(this.extensionsDir, { recursive: true });
    }
  }

  /**
   * Install an extension from a git URL or archive path.
   */
  async install(opts: {
    url: string;
    branch?: string;
    scope?: ExtensionScope;
    source?: ExtensionSource;
  }): Promise<InstalledExtension> {
    const source = opts.source ?? 'git';
    const scope = opts.scope ?? 'global';

    if (source === 'git') {
      return this.installFromGit(opts.url, opts.branch, scope);
    } else {
      return this.installFromArchive(opts.url, scope);
    }
  }

  /**
   * Install extension via git clone.
   */
  private installFromGit(url: string, branch: string | undefined, scope: ExtensionScope): InstalledExtension {
    // Derive extension name from URL
    const name = basename(url, '.git').replace(/[^a-zA-Z0-9_-]/g, '-');

    // Check if already installed
    const existing = this.extensionRepo.getByName(name);
    if (existing) {
      throw new Error(`Extension '${name}' is already installed`);
    }

    const targetDir = join(this.extensionsDir, name);

    try {
      // Clone the repository
      const branchArg = branch ? `--branch ${branch}` : '';
      execSync(`git clone ${branchArg} --depth 1 "${url}" "${targetDir}"`, {
        stdio: 'pipe',
        timeout: 60_000,
      });

      // Read and validate manifest
      const manifest = this.readManifest(targetDir);

      // Get commit hash
      let commit: string | null = null;
      try {
        commit = execSync('git rev-parse HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
      } catch {
        // Not critical
      }

      return this.extensionRepo.create({
        name,
        displayName: manifest?.display_name ?? name,
        version: manifest?.version ?? '0.0.0',
        description: manifest?.description ?? '',
        author: manifest?.author ?? '',
        source: 'git',
        scope,
        repoUrl: url,
        branch: branch ?? null,
        commit,
      });
    } catch (error) {
      // Cleanup on failure
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Install extension from an archive (zip) path.
   */
  private installFromArchive(path: string, scope: ExtensionScope): InstalledExtension {
    const name = basename(path, '.zip').replace(/[^a-zA-Z0-9_-]/g, '-');

    const existing = this.extensionRepo.getByName(name);
    if (existing) {
      throw new Error(`Extension '${name}' is already installed`);
    }

    const targetDir = join(this.extensionsDir, name);

    try {
      mkdirSync(targetDir, { recursive: true });

      // Extract archive (using system unzip)
      execSync(`unzip -o "${resolve(path)}" -d "${targetDir}"`, {
        stdio: 'pipe',
        timeout: 30_000,
      });

      const manifest = this.readManifest(targetDir);

      return this.extensionRepo.create({
        name,
        displayName: manifest?.display_name ?? name,
        version: manifest?.version ?? '0.0.0',
        description: manifest?.description ?? '',
        author: manifest?.author ?? '',
        source: 'archive',
        scope,
      });
    } catch (error) {
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * Update an extension (git pull for git-based extensions).
   */
  async update(nameOrId: string): Promise<InstalledExtension | null> {
    const ext = this.extensionRepo.getByName(nameOrId) ?? this.extensionRepo.get(nameOrId);
    if (!ext) return null;

    if (ext.source !== 'git') {
      throw new Error('Only git-based extensions can be updated');
    }

    const targetDir = join(this.extensionsDir, ext.name);
    if (!existsSync(targetDir)) {
      throw new Error(`Extension directory not found: ${targetDir}`);
    }

    try {
      execSync('git pull', { cwd: targetDir, stdio: 'pipe', timeout: 60_000 });

      let commit: string | null = null;
      try {
        commit = execSync('git rev-parse HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
      } catch {
        // Not critical
      }

      const manifest = this.readManifest(targetDir);

      return this.extensionRepo.update(ext.id, {
        version: manifest?.version ?? ext.version,
        commit: commit ?? undefined,
      });
    } catch (error) {
      logger.error(`Failed to update extension ${ext.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Uninstall an extension.
   */
  async uninstall(nameOrId: string): Promise<boolean> {
    const ext = this.extensionRepo.getByName(nameOrId) ?? this.extensionRepo.get(nameOrId);
    if (!ext) return false;

    // Remove directory
    const targetDir = join(this.extensionsDir, ext.name);
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }

    return this.extensionRepo.deleteByName(ext.name);
  }

  /**
   * List branches for a git-based extension.
   */
  listBranches(nameOrId: string): string[] {
    const ext = this.extensionRepo.getByName(nameOrId) ?? this.extensionRepo.get(nameOrId);
    if (!ext || ext.source !== 'git' || !ext.repoUrl) {
      return [];
    }

    try {
      const output = execSync(`git ls-remote --heads "${ext.repoUrl}"`, {
        stdio: 'pipe',
        timeout: 30_000,
      }).toString();

      return output
        .split('\n')
        .filter(Boolean)
        .map((line) => line.replace(/.*refs\/heads\//, ''));
    } catch {
      return [];
    }
  }

  /**
   * Check for updates across all git-based extensions.
   */
  async checkForUpdates(): Promise<UpdateCheckResult[]> {
    const { items } = this.extensionRepo.list();
    const results: UpdateCheckResult[] = [];

    for (const ext of items) {
      if (ext.source !== 'git' || !ext.repoUrl) continue;

      try {
        const targetDir = join(this.extensionsDir, ext.name);
        if (!existsSync(targetDir)) continue;

        const local = execSync('git rev-parse HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim();
        const remote = execSync(`git ls-remote "${ext.repoUrl}" HEAD`, { stdio: 'pipe' }).toString().split('\t')[0]?.trim() ?? '';

        results.push({
          name: ext.name,
          currentCommit: local,
          latestCommit: remote,
          hasUpdate: local !== remote && remote.length > 0,
        });
      } catch {
        // Skip extensions that can't be checked
      }
    }

    return results;
  }

  /**
   * Read manifest.json from an extension directory.
   */
  private readManifest(dir: string): ExtensionManifest | null {
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) return null;

    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const result = safeValidateExtensionManifest(raw);
      return result.success ? result.data! : null;
    } catch {
      return null;
    }
  }
}
