import { createApp } from './app';
import { connectDatabase } from './config/database';
import { validateConfig, config } from './config';
import { logger } from './shared/logger';

async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Connect to MongoDB
    await connectDatabase();

    // Create and start Express app
    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      logger.info(`DecisionTrace API running`, {
        host: config.host,
        port: config.port,
        environment: config.nodeEnv,
      });
      logger.info(`Health check: http://${config.host}:${config.port}/api/v1/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        const { disconnectDatabase } = await import('./config/database');
        await disconnectDatabase();
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

main();
