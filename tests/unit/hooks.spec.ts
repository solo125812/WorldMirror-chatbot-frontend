/**
 * Unit tests for HookDispatcher
 */

import { describe, it, expect } from 'vitest';
import { HookDispatcher } from '@chatbot/plugins';

describe('HookDispatcher', () => {
  it('dispatches hooks in priority order (lower first)', async () => {
    const dispatcher = new HookDispatcher();
    const calls: string[] = [];

    dispatcher.register('plugin-b', 'before_generation', () => {
      calls.push('b');
    }, 200);
    dispatcher.register('plugin-a', 'before_generation', () => {
      calls.push('a');
    }, 50);

    await dispatcher.dispatch('before_generation', {});
    expect(calls).toEqual(['a', 'b']);
  });

  it('continues dispatch after a handler throws', async () => {
    const dispatcher = new HookDispatcher();
    const calls: string[] = [];

    dispatcher.register('plugin-err', 'after_generation', () => {
      throw new Error('boom');
    }, 10);
    dispatcher.register('plugin-ok', 'after_generation', () => {
      calls.push('ok');
    }, 20);

    await dispatcher.dispatch('after_generation', {});
    expect(calls).toEqual(['ok']);
  });

  it('unregisters hooks by plugin', async () => {
    const dispatcher = new HookDispatcher();
    dispatcher.register('plugin-a', 'message_received', () => {}, 100);
    dispatcher.register('plugin-b', 'message_received', () => {}, 100);

    dispatcher.unregister('plugin-a');
    const events = dispatcher.getRegisteredEvents();
    expect(events.message_received).toBe(1);
    const hooks = dispatcher.getPluginHooks('plugin-a');
    expect(hooks).toEqual([]);
  });
});
