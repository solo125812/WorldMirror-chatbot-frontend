/**
 * Desktop Bridge — Exposes Tauri native APIs to the UI layer
 *
 * This module provides a typed interface for communicating with the
 * Tauri backend (Rust side), including server lifecycle management,
 * OS keychain access, and filesystem operations.
 */

// Type-safe wrapper around Tauri invoke
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Dynamic import to avoid errors when running in browser (non-Tauri) mode
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

/** Check if we're running inside a Tauri desktop shell */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ---------------------------------------------------------------------------
// Server Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start the embedded local server.
 * Returns the port the server is listening on.
 */
export async function startServer(): Promise<number> {
  return invoke<number>('start_server');
}

/**
 * Get the port of the currently running embedded server.
 * Returns null if the server hasn't been started yet.
 */
export async function getServerPort(): Promise<number | null> {
  return invoke<number | null>('get_server_port');
}

/**
 * Get the base URL for the embedded server.
 * Falls back to the default API_BASE if not running in Tauri.
 */
export async function getServerBaseUrl(): Promise<string> {
  if (!isTauri()) {
    return '/api';
  }
  const port = await getServerPort();
  if (port === null) {
    const newPort = await startServer();
    return `http://127.0.0.1:${newPort}`;
  }
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------------------
// OS Keychain
// ---------------------------------------------------------------------------

interface KeychainResult {
  success: boolean;
  value: string | null;
  error: string | null;
}

/**
 * Store a secret value in the OS keychain.
 * @param service - The service name (e.g., 'openai', 'anthropic')
 * @param key - The key name (e.g., 'apiKey')
 * @param value - The secret value to store
 */
export async function keychainSet(service: string, key: string, value: string): Promise<void> {
  const result = await invoke<KeychainResult>('keychain_set', { service, key, value });
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to set keychain value');
  }
}

/**
 * Retrieve a secret value from the OS keychain.
 * Returns null if the key doesn't exist.
 */
export async function keychainGet(service: string, key: string): Promise<string | null> {
  const result = await invoke<KeychainResult>('keychain_get', { service, key });
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to get keychain value');
  }
  return result.value;
}

/**
 * Delete a secret value from the OS keychain.
 */
export async function keychainDelete(service: string, key: string): Promise<void> {
  const result = await invoke<KeychainResult>('keychain_delete', { service, key });
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to delete keychain value');
  }
}

// ---------------------------------------------------------------------------
// Filesystem Bridge
// ---------------------------------------------------------------------------

/**
 * Read a file from the local filesystem.
 * Desktop-only — not available in browser mode.
 */
export async function readFile(path: string): Promise<string> {
  // Use Tauri's fs plugin
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(path);
}

/**
 * Write content to a file on the local filesystem.
 * Desktop-only — not available in browser mode.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, content);
}

/**
 * List files in a directory.
 * Desktop-only — not available in browser mode.
 */
export async function listDir(path: string): Promise<string[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  const entries = await readDir(path);
  return entries.map((entry) => entry.name).filter((name): name is string => name !== undefined);
}

/**
 * Check if a file or directory exists.
 * Desktop-only — not available in browser mode.
 */
export async function exists(path: string): Promise<boolean> {
  const { exists: fsExists } = await import('@tauri-apps/plugin-fs');
  return fsExists(path);
}

// ---------------------------------------------------------------------------
// Platform Info
// ---------------------------------------------------------------------------

/**
 * Get the current platform info.
 */
export async function getPlatformInfo(): Promise<{
  platform: string;
  arch: string;
  version: string;
}> {
  if (!isTauri()) {
    return {
      platform: 'web',
      arch: 'unknown',
      version: 'unknown',
    };
  }
  const { platform, arch, version } = await import('@tauri-apps/plugin-os');
  return {
    platform: platform(),
    arch: arch(),
    version: version(),
  };
}
