/**
 * Logs and Diagnostics API Client — communicates with /logs and /diagnostics server endpoints
 */

import { apiGet, apiPost } from './client.js';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  subsystem: string;
  message: string;
  data?: unknown;
}

export interface LogsResponse {
  entries: LogEntry[];
  count: number;
  stats: Record<string, number>;
  subsystems: string[];
}

export interface DiagnosticBundle {
  generatedAt: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    pid: number;
    uptime: number;
    memoryUsage: Record<string, number>;
    cwd: string;
  };
  versions: Record<string, string>;
  config: Record<string, unknown>;
  logStats: Record<string, number>;
  subsystems: string[];
  recentErrors: LogEntry[];
  recentWarnings: LogEntry[];
  recentLogs: LogEntry[];
}

/** Query recent log entries */
export async function queryLogs(opts?: {
  level?: string;
  subsystem?: string;
  limit?: number;
  since?: string;
}): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (opts?.level) params.set('level', opts.level);
  if (opts?.subsystem) params.set('subsystem', opts.subsystem);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.since) params.set('since', opts.since);
  const qs = params.toString();
  return apiGet<LogsResponse>(`/logs${qs ? `?${qs}` : ''}`);
}

/** Get log statistics */
export async function getLogStats(): Promise<{
  stats: Record<string, number>;
  subsystems: string[];
}> {
  return apiGet('/logs/stats');
}

/** Clear the log buffer */
export async function clearLogs(): Promise<{ cleared: boolean }> {
  return apiPost<{ cleared: boolean }>('/logs/clear', {});
}

/** Update log level */
export async function setLogLevel(
  level: string,
  subsystem?: string
): Promise<{ level: string; subsystem: string }> {
  return apiPost('/logs/level', { level, subsystem });
}

/** Get diagnostic bundle */
export async function getDiagnostics(): Promise<DiagnosticBundle> {
  return apiGet<DiagnosticBundle>('/diagnostics');
}

/** Download diagnostic bundle as file */
export function getDiagnosticsDownloadUrl(): string {
  return '/api/diagnostics/download';
}
