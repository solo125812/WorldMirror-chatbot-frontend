/**
 * Checks Runner — Feature/file validation system
 *
 * Usage:
 *   pnpm check               — Run all checks (lint, typecheck, tests, runtime)
 *   pnpm check chat          — Run only chat checks
 *   pnpm check --file <path> — Map file to feature, run associated checks
 *   pnpm check --fast        — Run lint + unit tests only
 *
 * Optional:
 *   CHECK_BASE_URL=http://localhost:3001  — Base URL for runtime checks
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Simple YAML parser (minimal, no dependency needed)
function parseYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  let currentKey = '';
  let currentSubKey = '';
  let currentList: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trimEnd();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Top-level key (no indentation)
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':')) {
      if (currentKey && currentSubKey) {
        result[currentKey][currentSubKey] = currentList;
        currentList = [];
      }
      currentKey = trimmed.slice(0, -1).trim();
      result[currentKey] = {};
      currentSubKey = '';
      continue;
    }

    // Sub-key (2-space indent)
    const subKeyMatch = trimmed.match(/^\s{2}(\w[\w_]*)\s*:/);
    if (subKeyMatch) {
      if (currentKey && currentSubKey) {
        result[currentKey][currentSubKey] = currentList;
        currentList = [];
      }
      currentSubKey = subKeyMatch[1];

      // Inline value
      const inlineVal = trimmed.slice(trimmed.indexOf(':') + 1).trim();
      if (inlineVal === '[]') {
        result[currentKey][currentSubKey] = [];
        currentSubKey = '';
      } else if (inlineVal && !inlineVal.startsWith('-')) {
        result[currentKey][currentSubKey] = inlineVal;
        currentSubKey = '';
      }
      continue;
    }

    // List item
    const listMatch = trimmed.match(/^\s+-\s+(.*)/);
    if (listMatch) {
      currentList.push(listMatch[1].trim());
      continue;
    }
  }

  // Flush last
  if (currentKey && currentSubKey) {
    result[currentKey][currentSubKey] = currentList;
  }

  return result;
}

// Parse CLI args
const args = process.argv.slice(2);
const featureArg = args.find((a) => !a.startsWith('--'));
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const fastMode = args.includes('--fast');
const debugMode = process.env.CHECK_DEBUG === '1';

// Load registry
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const registryPath = resolve(__dirname, 'registry.yml');

if (!existsSync(registryPath)) {
  console.error('❌ Registry file not found:', registryPath);
  process.exit(1);
}

const registryContent = readFileSync(registryPath, 'utf-8');
const registry = parseYaml(registryContent);

interface CheckResult {
  feature: string;
  check: string;
  passed: boolean;
  duration?: number;
  error?: string;
}

const results: CheckResult[] = [];
const startTime = Date.now();

function findFeatureByFile(filePath: string): string[] {
  const features: string[] = [];
  for (const [feature, config] of Object.entries(registry)) {
    const files = (config as any).files ?? [];
    if (files.some((f: string) => filePath.includes(f))) {
      features.push(feature);
    }
  }
  return features;
}

function runCheck(feature: string, check: string, command: string): CheckResult {
  const checkStart = Date.now();
  try {
    execSync(command, { stdio: 'pipe', cwd: projectRoot });
    const result: CheckResult = {
      feature,
      check,
      passed: true,
      duration: Date.now() - checkStart,
    };
    results.push(result);
    return result;
  } catch (e: any) {
    const result: CheckResult = {
      feature,
      check,
      passed: false,
      duration: Date.now() - checkStart,
      error: e.stderr?.toString()?.slice(0, 200) ?? e.message,
    };
    results.push(result);
    return result;
  }
}

function parseRuntimeEntry(entry: string): { kind: string; value: string } {
  const idx = entry.indexOf(':');
  if (idx === -1) {
    return { kind: 'unknown', value: entry.trim() };
  }
  return {
    kind: entry.slice(0, idx).trim().toLowerCase(),
    value: entry.slice(idx + 1).trim(),
  };
}

function buildUrl(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }
}

function defaultPayloadFor(path: string): Record<string, unknown> | null {
  if (path.includes('/chat/stream') || path.endsWith('/chat')) {
    return { message: 'Ping' };
  }
  return null;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runRuntimeCheck(
  feature: string,
  entry: string,
  baseUrl: string
): Promise<CheckResult> {
  const checkStart = Date.now();
  const { kind, value } = parseRuntimeEntry(entry);
  const label = `runtime: ${kind} ${value}`.trim();

  try {
    if (kind === 'health') {
      const url = buildUrl(baseUrl, value);
      const response = await fetchWithTimeout(url, { method: 'GET' });
      let passed = response.ok;
      let error: string | undefined;

      if (!response.ok) {
        error = `${response.status} ${response.statusText}`.trim();
      } else {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            const body = await response.json();
            if (body?.ok !== true) {
              passed = false;
              error = 'Health response missing ok:true';
            }
          } catch {
            // Ignore JSON parse failures when response is otherwise OK.
          }
        }
      }

      return {
        feature,
        check: label,
        passed,
        duration: Date.now() - checkStart,
        error,
      };
    }

    if (kind === 'endpoint') {
      const parts = value.split(/\s+/).filter(Boolean);
      const method = (parts[0] ?? 'GET').toUpperCase();
      const path = parts[1] ?? '/';
      const url = buildUrl(baseUrl, path);

      const headers: Record<string, string> = {};
      let body: string | undefined;
      if (!['GET', 'HEAD'].includes(method)) {
        const payload = defaultPayloadFor(path);
        if (payload) {
          body = JSON.stringify(payload);
          headers['content-type'] = 'application/json';
        }
      }

      const response = await fetchWithTimeout(url, { method, headers, body });
      let passed = response.ok;
      let error: string | undefined;

      if (!response.ok) {
        error = `${response.status} ${response.statusText}`.trim();
      } else if (path.includes('/chat/stream')) {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/event-stream')) {
          passed = false;
          error = `Expected text/event-stream, got ${contentType || 'unknown'}`;
        }
      }

      if (response.body) {
        try {
          await response.body.cancel();
        } catch {
          // Ignore cancel errors; response may already be closed.
        }
      }

      return {
        feature,
        check: label,
        passed,
        duration: Date.now() - checkStart,
        error,
      };
    }

    return {
      feature,
      check: label,
      passed: false,
      duration: Date.now() - checkStart,
      error: `Unsupported runtime check type: ${kind}`,
    };
  } catch (err: any) {
    return {
      feature,
      check: label,
      passed: false,
      duration: Date.now() - checkStart,
      error: err?.message ?? String(err),
    };
  }
}

// Determine which features to check
let featuresToCheck: string[];

if (fileArg) {
  featuresToCheck = findFeatureByFile(fileArg);
  if (featuresToCheck.length === 0) {
    console.log(`⚠️  No feature found for file: ${fileArg}`);
    process.exit(0);
  }
} else if (featureArg) {
  if (!registry[featureArg]) {
    console.error(`❌ Unknown feature: ${featureArg}`);
    console.log(`Available features: ${Object.keys(registry).join(', ')}`);
    process.exit(1);
  }
  featuresToCheck = [featureArg];
} else {
  featuresToCheck = Object.keys(registry);
}

console.log(`\n🔍 Running checks for: ${featuresToCheck.join(', ')}\n`);

function printSummaryAndExit() {
  console.log('\n' + '='.repeat(70));
  console.log('  CHECK RESULTS SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const duration = r.duration ? ` (${r.duration}ms)` : '';
    console.log(`  ${icon} [${r.feature}] ${r.check}${duration}`);
    if (r.error) {
      console.log(`     └─ ${r.error}`);
    }
  }

  console.log('\n' + '-'.repeat(70));
  console.log(`  Total: ${results.length}  |  ✅ Passed: ${passed.length}  |  ❌ Failed: ${failed.length}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);
  console.log('='.repeat(70) + '\n');

  if (debugMode) {
    const tracePath = resolve(__dirname, 'trace.json');
    writeFileSync(tracePath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
    console.log(`📋 Trace written to ${tracePath}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

async function main() {
  // Run file existence checks
  for (const feature of featuresToCheck) {
    const config = registry[feature] as any;
    const files = config.files ?? [];

    for (const file of files) {
      const fullPath = resolve(projectRoot, file);
      const exists = existsSync(fullPath);
      results.push({
        feature,
        check: `file: ${file}`,
        passed: exists,
        error: exists ? undefined : 'File not found',
      });
    }
  }

  if (fastMode) {
    runCheck('global', 'lint', 'pnpm lint');
    runCheck('global', 'test: unit', 'npx vitest run tests/unit --reporter=verbose');
    printSummaryAndExit();
    return;
  }

  runCheck('global', 'lint', 'pnpm lint');
  runCheck('global', 'typecheck', 'pnpm typecheck');

  // Run test checks
  for (const feature of featuresToCheck) {
    const config = registry[feature] as any;
    const tests = config.tests ?? [];

    for (const testFile of tests) {
      const fullPath = resolve(projectRoot, testFile);
      if (existsSync(fullPath)) {
        runCheck(feature, `test: ${testFile}`, `npx vitest run ${testFile} --reporter=verbose`);
      } else {
        results.push({
          feature,
          check: `test: ${testFile}`,
          passed: false,
          error: 'Test file not found',
        });
      }
    }
  }

  // Run runtime checks
  const rawBaseUrl = process.env.CHECK_BASE_URL ?? 'http://localhost:3001';
  const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl : `http://${rawBaseUrl}`;
  for (const feature of featuresToCheck) {
    const config = registry[feature] as any;
    const runtimeChecks = config.runtime_checks ?? [];
    for (const entry of runtimeChecks) {
      let entryString: string;
      if (typeof entry === 'object' && entry !== null) {
        const [kind, value] = Object.entries(entry)[0] ?? ['unknown', ''];
        entryString = `${kind}: ${value}`.trim();
      } else {
        entryString = String(entry);
      }

      const result = await runRuntimeCheck(feature, entryString, baseUrl);
      results.push(result);
    }
  }

  printSummaryAndExit();
}

main().catch((err) => {
  console.error('❌ Checks runner failed', err);
  process.exit(1);
});
