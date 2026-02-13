/**
 * Structured Logger — Phase 6 Enhanced
 *
 * Features:
 * - Per-subsystem channels (child loggers)
 * - JSON output mode for machine-readable logs
 * - In-memory ring buffer for diagnostic access via /logs endpoint
 * - Configurable log levels per subsystem
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  message: string;
  data?: unknown;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Ring Buffer — stores recent log entries in memory
// ---------------------------------------------------------------------------

const DEFAULT_BUFFER_SIZE = 2000;

class LogRingBuffer {
  private buffer: LogEntry[];
  private head = 0;
  private count = 0;
  private capacity: number;

  constructor(capacity = DEFAULT_BUFFER_SIZE) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(entry: LogEntry): void {
    this.buffer[this.head] = entry;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Return entries in chronological order */
  getAll(): LogEntry[] {
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count);
    }
    // Wrap around — oldest entries start at head
    return [...this.buffer.slice(this.head), ...this.buffer.slice(0, this.head)];
  }

  /** Return the last N entries */
  getLast(n: number): LogEntry[] {
    const all = this.getAll();
    return all.slice(Math.max(0, all.length - n));
  }

  /** Filter entries by level and/or subsystem */
  query(opts: {
    level?: LogLevel;
    subsystem?: string;
    limit?: number;
    since?: string;
  }): LogEntry[] {
    let entries = this.getAll();

    if (opts.since) {
      entries = entries.filter((e) => e.timestamp >= opts.since!);
    }

    if (opts.level) {
      const minLevel = LEVELS[opts.level];
      entries = entries.filter((e) => LEVELS[e.level] >= minLevel);
    }

    if (opts.subsystem) {
      entries = entries.filter((e) => e.subsystem === opts.subsystem);
    }

    if (opts.limit && opts.limit > 0) {
      entries = entries.slice(Math.max(0, entries.length - opts.limit));
    }

    return entries;
  }

  /** Get count of entries by level */
  stats(): Record<LogLevel, number> {
    const result = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const entry of this.getAll()) {
      result[entry.level]++;
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Logger Configuration
// ---------------------------------------------------------------------------

interface LoggerConfig {
  /** Global minimum log level */
  level: LogLevel;
  /** Per-subsystem log level overrides */
  subsystemLevels: Record<string, LogLevel>;
  /** Output as JSON instead of human-readable format */
  jsonOutput: boolean;
  /** Ring buffer capacity */
  bufferSize: number;
}

const config: LoggerConfig = {
  level: 'info',
  subsystemLevels: {},
  jsonOutput: false,
  bufferSize: DEFAULT_BUFFER_SIZE,
};

// Shared ring buffer instance
const ringBuffer = new LogRingBuffer(config.bufferSize);

// ---------------------------------------------------------------------------
// Logger Implementation
// ---------------------------------------------------------------------------

function shouldLog(level: LogLevel, subsystem: string): boolean {
  const subsystemLevel = config.subsystemLevels[subsystem];
  const effectiveLevel = subsystemLevel ?? config.level;
  return LEVELS[level] >= LEVELS[effectiveLevel];
}

function formatHuman(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.subsystem}]`;
  if (entry.data !== undefined) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`;
  }
  return `${prefix} ${entry.message}`;
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function emit(level: LogLevel, subsystem: string, message: string, data?: unknown): void {
  if (!shouldLog(level, subsystem)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    subsystem,
    message,
    data,
  };

  // Store in ring buffer
  ringBuffer.push(entry);

  // Output to console
  const formatted = config.jsonOutput ? formatJson(entry) : formatHuman(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SubLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

function createSubLogger(subsystem: string): SubLogger {
  return {
    debug: (message: string, data?: unknown) => emit('debug', subsystem, message, data),
    info: (message: string, data?: unknown) => emit('info', subsystem, message, data),
    warn: (message: string, data?: unknown) => emit('warn', subsystem, message, data),
    error: (message: string, data?: unknown) => emit('error', subsystem, message, data),
  };
}

export const logger = {
  /** Set the global log level */
  setLevel(level: LogLevel) {
    config.level = level;
  },

  /** Set log level for a specific subsystem */
  setSubsystemLevel(subsystem: string, level: LogLevel) {
    config.subsystemLevels[subsystem] = level;
  },

  /** Enable/disable JSON output */
  setJsonOutput(enabled: boolean) {
    config.jsonOutput = enabled;
  },

  /** Create a child logger for a specific subsystem */
  child(subsystem: string): SubLogger {
    return createSubLogger(subsystem);
  },

  // Default subsystem methods (backwards compatible)
  debug(message: string, data?: unknown) {
    emit('debug', 'app', message, data);
  },

  info(message: string, data?: unknown) {
    emit('info', 'app', message, data);
  },

  warn(message: string, data?: unknown) {
    emit('warn', 'app', message, data);
  },

  error(message: string, data?: unknown) {
    emit('error', 'app', message, data);
  },

  // Ring buffer access for diagnostics
  /** Get recent log entries */
  getRecentLogs(limit = 100): LogEntry[] {
    return ringBuffer.getLast(limit);
  },

  /** Query log entries with filters */
  queryLogs(opts: {
    level?: LogLevel;
    subsystem?: string;
    limit?: number;
    since?: string;
  }): LogEntry[] {
    return ringBuffer.query(opts);
  },

  /** Get log statistics */
  getStats(): Record<LogLevel, number> {
    return ringBuffer.stats();
  },

  /** Get all subsystem names that have logged */
  getSubsystems(): string[] {
    const subs = new Set<string>();
    for (const entry of ringBuffer.getAll()) {
      subs.add(entry.subsystem);
    }
    return Array.from(subs);
  },

  /** Clear the log buffer */
  clearBuffer(): void {
    ringBuffer.clear();
  },
};
