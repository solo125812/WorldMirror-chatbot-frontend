/**
 * Unit tests for plugin manifest validation and permissions
 */

import { describe, it, expect } from 'vitest';
import { validateManifest, safeValidateManifest } from '@chatbot/plugins';
import { validatePermissions, hasPermission, getPendingPermissions } from '@chatbot/plugins';
import type { InstalledPlugin, PluginPermission } from '@chatbot/types';

describe('Plugin Manifest Validation', () => {
  const validManifest = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    entry: 'index.ts',
    permissions: ['network', 'memory:read'],
  };

  it('should validate a correct manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.id).toBe('test-plugin');
    expect(result.name).toBe('Test Plugin');
    expect(result.version).toBe('1.0.0');
    expect(result.permissions).toEqual(['network', 'memory:read']);
  });

  it('should reject invalid plugin IDs', () => {
    const result = safeValidateManifest({ ...validManifest, id: 'Invalid ID!' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('id');
  });

  it('should reject missing name', () => {
    const result = safeValidateManifest({ ...validManifest, name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid version format', () => {
    const result = safeValidateManifest({ ...validManifest, version: 'abc' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('version');
  });

  it('should reject unknown permissions', () => {
    const result = safeValidateManifest({ ...validManifest, permissions: ['unknown-perm'] });
    expect(result.success).toBe(false);
  });

  it('should accept manifest with configSchema', () => {
    const result = validateManifest({
      ...validManifest,
      configSchema: {
        apiKey: { type: 'string', label: 'API Key', sensitive: true },
      },
    });
    expect(result.configSchema).toBeDefined();
    expect(result.configSchema!.apiKey.sensitive).toBe(true);
  });

  it('should default description to empty string', () => {
    const { description, ...rest } = validManifest;
    const result = validateManifest(rest);
    expect(result.description).toBe('');
  });

  it('should default permissions to empty array', () => {
    const { permissions, ...rest } = validManifest;
    const result = validateManifest(rest);
    expect(result.permissions).toEqual([]);
  });
});

describe('Plugin Permissions', () => {
  const mockPlugin: InstalledPlugin = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: '',
    entry: 'index.ts',
    enabled: true,
    permissions: ['network', 'memory:read', 'tools:register'],
    configSchema: null,
    pluginConfig: null,
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should validate known permissions', () => {
    const result = validatePermissions(['network', 'memory:read']);
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it('should detect unknown permissions', () => {
    const result = validatePermissions(['network', 'super-power']);
    expect(result.valid).toBe(false);
    expect(result.unknown).toEqual(['super-power']);
  });

  it('should check granted permissions', () => {
    const grants: Array<{ permission: PluginPermission; granted: boolean }> = [
      { permission: 'network', granted: true },
      { permission: 'memory:read', granted: false },
    ];

    expect(hasPermission(mockPlugin, 'network', grants)).toBe(true);
    expect(hasPermission(mockPlugin, 'memory:read', grants)).toBe(false);
    expect(hasPermission(mockPlugin, 'filesystem:read', grants)).toBe(false); // not declared
  });

  it('should list pending permissions', () => {
    const grants: Array<{ permission: PluginPermission; granted: boolean }> = [
      { permission: 'network', granted: true },
    ];

    const pending = getPendingPermissions(mockPlugin, grants);
    expect(pending).toContain('memory:read');
    expect(pending).toContain('tools:register');
    expect(pending).not.toContain('network');
  });
});
