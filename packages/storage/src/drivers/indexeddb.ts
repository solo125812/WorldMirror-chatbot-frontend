/**
 * IndexedDB storage driver stub
 * TODO: Implement full IndexedDB support for browser persistence
 */

import type { StorageDriver } from '../driver.js';
import { MemoryDriver } from './memory.js';

/**
 * IndexedDB driver - currently falls back to in-memory storage.
 * Will be implemented with real IndexedDB in Phase 2.
 */
export class IndexedDBDriver implements StorageDriver {
  private fallback = new MemoryDriver();

  async getItem(key: string): Promise<string | null> {
    // TODO: Implement IndexedDB get
    return this.fallback.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    // TODO: Implement IndexedDB set
    return this.fallback.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    // TODO: Implement IndexedDB remove
    return this.fallback.removeItem(key);
  }

  async keys(): Promise<string[]> {
    // TODO: Implement IndexedDB keys
    return this.fallback.keys();
  }

  async clear(): Promise<void> {
    // TODO: Implement IndexedDB clear
    return this.fallback.clear();
  }
}
