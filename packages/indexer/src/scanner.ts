/**
 * File scanner — §10.1 Pipeline Step 1-3
 *
 * Walks directory tree with ignore rules,
 * detects languages, and produces a list of files to index.
 */

import type { ScannedFile, IgnoreConfig } from '@chatbot/types';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { logger } from '@chatbot/utils';

/** Language detection by file extension */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.php': 'php',
  '.lua': 'lua',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.svelte': 'svelte',
  '.vue': 'vue',
  '.r': 'r',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.zig': 'zig',
};

/** Default ignore patterns */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.svelte-kit',
  '__pycache__',
  '.venv',
  'venv',
  '.env',
  '*.lock',
  '*.log',
  '.DS_Store',
  'coverage',
  '.turbo',
];

/** Max file size to index (1MB) */
const MAX_FILE_SIZE = 1_048_576;

/**
 * Detect programming language from file extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? 'unknown';
}

/**
 * Compute SHA-256 hash of file content.
 */
export function hashFile(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Check if a path matches any ignore pattern.
 */
function shouldIgnore(relativePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching (exact segment match or extension match)
    if (pattern.startsWith('*.')) {
      // Extension pattern
      if (relativePath.endsWith(pattern.slice(1))) return true;
    } else {
      // Directory/file name match
      const segments = relativePath.split('/');
      if (segments.includes(pattern)) return true;
    }
  }
  return false;
}

/**
 * Load ignore patterns from .gitignore and .rooignore files.
 */
export function loadIgnorePatterns(workspacePath: string, userPatterns: string[] = []): string[] {
  const patterns = [...DEFAULT_IGNORE_PATTERNS, ...userPatterns];

  // Load .gitignore
  const gitignorePath = join(workspacePath, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const lines = readFileSync(gitignorePath, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      patterns.push(...lines);
    } catch {
      // Ignore read errors
    }
  }

  // Load .rooignore
  const rooignorePath = join(workspacePath, '.rooignore');
  if (existsSync(rooignorePath)) {
    try {
      const lines = readFileSync(rooignorePath, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      patterns.push(...lines);
    } catch {
      // Ignore read errors
    }
  }

  return [...new Set(patterns)];
}

/**
 * Scan a workspace directory and return a list of indexable files.
 */
export function scanWorkspace(workspacePath: string, ignorePatterns?: string[]): ScannedFile[] {
  const patterns = ignorePatterns ?? loadIgnorePatterns(workspacePath);
  const files: ScannedFile[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(workspacePath, fullPath);

      if (shouldIgnore(relPath, patterns)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = statSync(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;
          if (stat.size === 0) continue;

          const language = detectLanguage(fullPath);
          if (language === 'unknown') continue;

          const content = readFileSync(fullPath, 'utf-8');
          const hash = hashFile(content);

          files.push({
            path: fullPath,
            relativePath: relPath,
            language,
            size: stat.size,
            hash,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  walk(workspacePath);
  logger.debug(`Scanned workspace: ${files.length} files found in ${workspacePath}`);
  return files;
}
