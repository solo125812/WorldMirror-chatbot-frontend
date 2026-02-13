/**
 * Skills API Routes — list, get, and enable/disable skills
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getContainer } from '../../di/container.js';

export async function skillRoutes(app: FastifyInstance) {
  /** GET /skills — list all discovered skills */
  app.get('/skills', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { skillRegistry } = getContainer();
    const skills = skillRegistry.listAll();
    return reply.send({ skills });
  });

  /** GET /skills/:id — get skill details */
  app.get('/skills/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { skillRegistry } = getContainer();
    const { id } = request.params as { id: string };

    const skill = skillRegistry.get(id);
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' });
    }

    // Load content on demand
    const content = skillRegistry.loadContent(id);
    return reply.send({ ...skill, content });
  });

  /** POST /skills/:id/enable — enable a skill */
  app.post('/skills/:id/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { skillRegistry } = getContainer();
    const { id } = request.params as { id: string };

    const skill = skillRegistry.get(id);
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' });
    }

    skillRegistry.setEnabled(id, true);
    return reply.send({ success: true, id, enabled: true });
  });

  /** POST /skills/:id/disable — disable a skill */
  app.post('/skills/:id/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const { skillRegistry } = getContainer();
    const { id } = request.params as { id: string };

    const skill = skillRegistry.get(id);
    if (!skill) {
      return reply.status(404).send({ error: 'Skill not found' });
    }

    skillRegistry.setEnabled(id, false);
    return reply.send({ success: true, id, enabled: false });
  });

  /** POST /skills/rescan — rescan skill directories */
  app.post('/skills/rescan', async (_request: FastifyRequest, reply: FastifyReply) => {
    const { skillRegistry } = getContainer();
    skillRegistry.scan();
    const skills = skillRegistry.listAll();
    return reply.send({ success: true, count: skills.length, skills });
  });
}
