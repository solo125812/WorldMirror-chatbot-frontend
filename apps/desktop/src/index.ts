/**
 * Desktop App Entry Point
 *
 * Re-exports the bridge module for use by the web UI when
 * running inside the Tauri desktop shell.
 */

export { isTauri, startServer, getServerPort, getServerBaseUrl } from './bridge.js';
export { keychainSet, keychainGet, keychainDelete } from './bridge.js';
export { readFile, writeFile, listDir, exists } from './bridge.js';
export { getPlatformInfo } from './bridge.js';
