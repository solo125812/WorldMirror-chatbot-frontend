/**
 * AutoStorage — Platform-adaptive storage routing
 * Returns the appropriate storage driver based on the runtime environment.
 */

import type { StorageDriver } from './driver.js';
import { MemoryDriver } from './drivers/memory.js';

export class AutoStorage {
  private static instance: StorageDriver | null = null;

  /**
   * Initialize and return the appropriate storage driver.
   * In Phase 1, always returns MemoryDriver.
   */
  static async init(): Promise<StorageDriver> {
    if (AutoStorage.instance) {
      return AutoStorage.instance;
    }

    // Phase 1: Default to in-memory storage
    // TODO: Detect environment and use IndexedDB for browser, filesystem for server
    AutoStorage.instance = new MemoryDriver();
    return AutoStorage.instance;
  }

  /**
   * Get the current storage driver instance.
   * Throws if init() hasn't been called.
   */
  static get(): StorageDriver {
    if (!AutoStorage.instance) {
      throw new Error('AutoStorage not initialized. Call AutoStorage.init() first.');
    }
    return AutoStorage.instance;
  }

  /**
   * Reset the storage instance (primarily for testing).
   */
  static reset(): void {
    AutoStorage.instance = null;
  }
}
