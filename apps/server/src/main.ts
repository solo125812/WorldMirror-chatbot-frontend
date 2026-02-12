/**
 * Server entry point
 */

import { buildApp } from './app.js';
import { logger } from '@chatbot/utils';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? 'localhost';

async function main() {
  try {
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });

    logger.info(`Server listening on http://${HOST}:${PORT}`);
    logger.info('Available routes:');
    logger.info('  GET  /health');
    logger.info('  GET  /models');
    logger.info('  GET  /config');
    logger.info('  PATCH /config');
    logger.info('  POST /chat');
    logger.info('  POST /chat/stream');
    logger.info('  GET  /chats');
    logger.info('  GET  /chats/:id');
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main();
