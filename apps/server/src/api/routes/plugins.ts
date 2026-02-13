/**
 * Plugin management routes — §11
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function pluginRoutes(app: FastifyInstance) {
  // GET /plugins — List installed plugins
  app.get('/plugins', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { pluginRepo } = getContainer();
    const result = pluginRepo.list();
    return reply.send(result);
  });

  // POST /plugins/install — Install a plugin from manifest
  app.post('/plugins/install', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginLoader } = getContainer();
    const body = request.body as any;

    if (!body?.manifest) {
      return reply.status(400).send({ error: 'manifest is required' });
    }

    try {
      const plugin = pluginLoader.install(body.manifest);
      return reply.status(201).send(plugin);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Failed to install plugin',
      });
    }
  });

  // GET /plugins/:id — Get plugin details
  app.get('/plugins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginRepo } = getContainer();
    const { id } = request.params as { id: string };
    const plugin = pluginRepo.get(id);
    if (!plugin) {
      return reply.status(404).send({ error: 'Plugin not found' });
    }

    const permissions = pluginRepo.getPermissions(id);
    return reply.send({ ...plugin, grantedPermissions: permissions });
  });

  // POST /plugins/:id/enable — Enable a plugin
  app.post('/plugins/:id/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginLoader } = getContainer();
    const { id } = request.params as { id: string };
    const result = pluginLoader.setEnabled(id, true);
    if (!result) {
      return reply.status(404).send({ error: 'Plugin not found' });
    }
    return reply.send(result);
  });

  // POST /plugins/:id/disable — Disable a plugin
  app.post('/plugins/:id/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginLoader } = getContainer();
    const { id } = request.params as { id: string };
    const result = pluginLoader.setEnabled(id, false);
    if (!result) {
      return reply.status(404).send({ error: 'Plugin not found' });
    }
    return reply.send(result);
  });

  // PATCH /plugins/:id — Update plugin config
  app.patch('/plugins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = pluginRepo.update(id, body);
    if (!result) {
      return reply.status(404).send({ error: 'Plugin not found' });
    }
    return reply.send(result);
  });

  // DELETE /plugins/:id — Uninstall a plugin
  app.delete('/plugins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginLoader } = getContainer();
    const { id } = request.params as { id: string };
    const deleted = pluginLoader.uninstall(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Plugin not found' });
    }
    return reply.send({ deleted: true });
  });

  // POST /plugins/:id/permissions — Grant a permission
  app.post('/plugins/:id/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginRepo } = getContainer();
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (!body?.permission) {
      return reply.status(400).send({ error: 'permission is required' });
    }

    pluginRepo.grantPermission(id, body.permission);
    const permissions = pluginRepo.getPermissions(id);
    return reply.send({ permissions });
  });

  // DELETE /plugins/:id/permissions/:permission — Revoke a permission
  app.delete('/plugins/:id/permissions/:permission', async (request: FastifyRequest, reply: FastifyReply) => {
    const { pluginRepo } = getContainer();
    const { id, permission } = request.params as { id: string; permission: string };
    pluginRepo.revokePermission(id, permission as any);
    const permissions = pluginRepo.getPermissions(id);
    return reply.send({ permissions });
  });

  // GET /plugins/tools — List all registered tools
  app.get('/plugins/tools', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { pluginLoader } = getContainer();
    return reply.send({ tools: pluginLoader.getRegisteredTools() });
  });
}
