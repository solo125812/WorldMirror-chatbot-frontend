/**
 * Extension manager types — §12 Extension Manager
 */

/** Extension installation source */
export type ExtensionSource = 'git' | 'archive';

/** Extension scope */
export type ExtensionScope = 'global' | 'profile';

/** Extension manifest (manifest.json inside extension directory) */
export interface ExtensionManifest {
  display_name: string;
  version: string;
  description: string;
  author: string;
  requires: string[];
  optional: string[];
  js?: string;
  css?: string;
}

/** Installed extension record (persisted) */
export interface InstalledExtension {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  source: ExtensionSource;
  scope: ExtensionScope;
  repoUrl: string | null;
  branch: string | null;
  commit: string | null;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}

/** Payload to install an extension */
export interface InstallExtensionPayload {
  url: string;
  branch?: string;
  scope?: ExtensionScope;
  source?: ExtensionSource;
}

/** Payload to update an extension */
export interface UpdateExtensionPayload {
  enabled?: boolean;
}

/** Result of an update check */
export interface UpdateCheckResult {
  name: string;
  currentCommit: string;
  latestCommit: string;
  hasUpdate: boolean;
}

/** Extension info returned from API */
export interface ExtensionInfo {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  source: ExtensionSource;
  scope: ExtensionScope;
  repoUrl: string | null;
  branch: string | null;
  commit: string | null;
  enabled: boolean;
  installedAt: string;
  updatedAt: string;
}
