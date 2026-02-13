/**
 * Lifecycle hook dispatcher — §11.3
 *
 * Manages plugin lifecycle hooks and dispatches events
 * to registered handlers in priority order.
 */

import type { PluginHookEvent } from '@chatbot/types';
import { logger } from '@chatbot/utils';

export type HookHandler = (context: Record<string, unknown>) => Promise<void> | void;

interface RegisteredHook {
  pluginId: string;
  event: PluginHookEvent;
  handler: HookHandler;
  priority: number;
}

/**
 * HookDispatcher manages all lifecycle hook registrations
 * and dispatches events to handlers in priority order.
 */
export class HookDispatcher {
  private hooks: RegisteredHook[] = [];

  /**
   * Register a hook handler for a specific event.
   */
  register(pluginId: string, event: PluginHookEvent, handler: HookHandler, priority: number = 100): void {
    this.hooks.push({ pluginId, event, handler, priority });
    // Sort by priority (lower = earlier execution)
    this.hooks.sort((a, b) => a.priority - b.priority);
    logger.debug(`Hook registered: ${event} by ${pluginId} (priority: ${priority})`);
  }

  /**
   * Remove all hooks registered by a specific plugin.
   */
  unregister(pluginId: string): void {
    const before = this.hooks.length;
    this.hooks = this.hooks.filter((h) => h.pluginId !== pluginId);
    const removed = before - this.hooks.length;
    if (removed > 0) {
      logger.debug(`Removed ${removed} hooks for plugin ${pluginId}`);
    }
  }

  /**
   * Dispatch an event to all registered handlers.
   * Handlers execute sequentially in priority order.
   * Errors in one handler don't prevent others from executing.
   */
  async dispatch(event: PluginHookEvent, context: Record<string, unknown> = {}): Promise<void> {
    const handlers = this.hooks.filter((h) => h.event === event);
    if (handlers.length === 0) return;

    logger.debug(`Dispatching hook ${event} to ${handlers.length} handlers`);

    for (const hook of handlers) {
      try {
        await hook.handler(context);
      } catch (error) {
        logger.error(`Hook handler error: ${event} in plugin ${hook.pluginId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get count of registered hooks per event.
   */
  getRegisteredEvents(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const hook of this.hooks) {
      counts[hook.event] = (counts[hook.event] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Get all hooks registered by a specific plugin.
   */
  getPluginHooks(pluginId: string): Array<{ event: PluginHookEvent; priority: number }> {
    return this.hooks
      .filter((h) => h.pluginId === pluginId)
      .map((h) => ({ event: h.event, priority: h.priority }));
  }

  /**
   * Clear all registered hooks.
   */
  clear(): void {
    this.hooks = [];
  }
}
