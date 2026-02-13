/**
 * Extension management routes — §12
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function extensionRoutes(app: FastifyInstance) {
  // GET /extensions — List installed extensions
  app.get('/extensions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionRepo } = getContainer();
    const query = request.query as any;
    const result = extensionRepo.list({
      scope: query.scope,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    return reply.send(result);
  });

  // POST /extensions/install — Install an extension
  app.post('/extensions/install', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionManager } = getContainer();
    const body = request.body as any;

    if (!body?.url) {
      return reply.status(400).send({ error: 'url is required' });
    }

    try {
      const ext = await extensionManager.install({
        url: body.url,
        branch: body.branch,
        scope: body.scope,
        source: body.source,
      });
      return reply.status(201).send(ext);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Failed to install extension',
      });
    }
  });

  // POST /extensions/update — Update an extension
  app.post('/extensions/update', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionManager } = getContainer();
    const body = request.body as any;

    if (!body?.name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    try {
      const ext = await extensionManager.update(body.name);
      if (!ext) {
        return reply.status(404).send({ error: 'Extension not found' });
      }
      return reply.send(ext);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Failed to update extension',
      });
    }
  });

  // POST /extensions/branches — List branches for an extension
  app.post('/extensions/branches', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionManager } = getContainer();
    const body = request.body as any;

    if (!body?.name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    const branches = extensionManager.listBranches(body.name);
    return reply.send({ branches });
  });

  // DELETE /extensions/:name — Uninstall an extension
  app.delete('/extensions/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionManager } = getContainer();
    const { name } = request.params as { name: string };

    const deleted = await extensionManager.uninstall(name);
    if (!deleted) {
      return reply.status(404).send({ error: 'Extension not found' });
    }
    return reply.send({ deleted: true });
  });

  // GET /extensions/:name — Get extension details
  app.get('/extensions/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionRepo } = getContainer();
    const { name } = request.params as { name: string };
    const ext = extensionRepo.getByName(name) ?? extensionRepo.get(name);
    if (!ext) {
      return reply.status(404).send({ error: 'Extension not found' });
    }
    return reply.send(ext);
  });

  // PATCH /extensions/:name — Update extension settings (enable/disable)
  app.patch('/extensions/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const { extensionRepo } = getContainer();
    const { name } = request.params as { name: string };
    const body = request.body as any;
    const ext = extensionRepo.getByName(name) ?? extensionRepo.get(name);
    if (!ext) {
      return reply.status(404).send({ error: 'Extension not found' });
    }
    const updated = extensionRepo.update(ext.id, { enabled: body.enabled });
    return reply.send(updated);
  });

  // POST /extensions/check-updates — Check for updates across all extensions
  app.post('/extensions/check-updates', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { extensionManager } = getContainer();
    const updates = await extensionManager.checkForUpdates();
    return reply.send({ updates });
  });
}
