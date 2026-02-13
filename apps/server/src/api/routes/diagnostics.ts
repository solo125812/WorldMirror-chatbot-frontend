/**
 * Logs and Diagnostics routes — Phase 6 §53 Observability
 *
 * Provides access to recent log entries and diagnostic bundle export.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger, AppError } from '@chatbot/utils';
import type { LogLevel } from '@chatbot/utils';
import { getContainer } from '../../di/container.js';

export async function diagnosticsRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // GET /logs — Query recent log entries from the in-memory ring buffer
  // -----------------------------------------------------------------------
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    const level = query.level as LogLevel | undefined;
    const subsystem = query.subsystem as string | undefined;
    const limit = query.limit ? parseInt(query.limit, 10) : 200;
    const since = query.since as string | undefined;

    const entries = logger.queryLogs({
      level,
      subsystem,
      limit: Math.min(limit, 2000),
      since,
    });

    return reply.send({
      entries,
      count: entries.length,
      stats: logger.getStats(),
      subsystems: logger.getSubsystems(),
    });
  });

  // -----------------------------------------------------------------------
  // GET /logs/stats — Get log statistics
  // -----------------------------------------------------------------------
  app.get('/logs/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      stats: logger.getStats(),
      subsystems: logger.getSubsystems(),
    });
  });

  // -----------------------------------------------------------------------
  // POST /logs/clear — Clear the log buffer
  // -----------------------------------------------------------------------
  app.post('/logs/clear', async (_request: FastifyRequest, reply: FastifyReply) => {
    logger.clearBuffer();
    return reply.send({ cleared: true });
  });

  // -----------------------------------------------------------------------
  // POST /logs/level — Update log level dynamically
  // -----------------------------------------------------------------------
  app.post('/logs/level', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

    if (!body?.level || !validLevels.includes(body.level)) {
      throw AppError.badRequest(`Invalid log level. Must be one of: ${validLevels.join(', ')}`);
    }

    if (body.subsystem) {
      logger.setSubsystemLevel(body.subsystem, body.level);
    } else {
      logger.setLevel(body.level);
    }

    return reply.send({
      level: body.level,
      subsystem: body.subsystem ?? 'global',
    });
  });

  // -----------------------------------------------------------------------
  // GET /diagnostics — Export a diagnostic bundle
  // -----------------------------------------------------------------------
  app.get('/diagnostics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const container = getContainer();
    const config = container.configService.get();

    // Collect system info
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cwd: process.cwd(),
    };

    // Collect app versions
    const versions = {
      app: '0.1.0',
      node: process.version,
      v8: process.versions.v8,
    };

    // Collect recent errors
    const recentErrors = logger.queryLogs({
      level: 'error',
      limit: 50,
    });

    // Collect recent warnings
    const recentWarnings = logger.queryLogs({
      level: 'warn',
      limit: 50,
    });

    // Sanitized config (remove sensitive fields)
    const sanitizedConfig = {
      ...config,
      providers: (config.providers ?? []).map((p: any) => ({
        ...p,
        apiKey: p.apiKey ? '***REDACTED***' : undefined,
      })),
    };

    // Log stats
    const logStats = logger.getStats();
    const subsystems = logger.getSubsystems();

    // Recent logs (last 500)
    const recentLogs = logger.getRecentLogs(500);

    const bundle = {
      generatedAt: new Date().toISOString(),
      system: systemInfo,
      versions,
      config: sanitizedConfig,
      logStats,
      subsystems,
      recentErrors,
      recentWarnings,
      recentLogs,
    };

    return reply.send(bundle);
  });

  // -----------------------------------------------------------------------
  // GET /diagnostics/download — Download diagnostic bundle as JSON file
  // -----------------------------------------------------------------------
  app.get('/diagnostics/download', async (request: FastifyRequest, reply: FastifyReply) => {
    // Re-use the diagnostics endpoint logic
    const diagnosticsResponse = await app.inject({
      method: 'GET',
      url: '/diagnostics',
    });

    const bundle = JSON.parse(diagnosticsResponse.body);

    reply
      .header('Content-Type', 'application/json')
      .header(
        'Content-Disposition',
        `attachment; filename="worldmirror-diagnostics-${Date.now()}.json"`
      )
      .send(JSON.stringify(bundle, null, 2));
  });
}
