/**
 * Minehunt AI - Main Entry Point
 * Autonomous Minecraft 1.20.1 Hunter
 */

const { BotController } = require('./core/bot');
const { DashboardServer } = require('./api/server');
const { getLogger } = require('./core/logger');

async function main() {
  const logger = getLogger();
  
  logger.info('╔════════════════════════════════════════════════════╗');
  logger.info('║           MINEHUNT AI v1.0.0                       ║');
  logger.info('║  Autonomous Minecraft 1.20.1 Hunter                ║');
  logger.info('╚════════════════════════════════════════════════════╝');
  
  try {
    // Initialize bot controller
    const botController = new BotController();
    
    // Start dashboard server first (so we can monitor connection)
    const dashboard = new DashboardServer(botController);
    await dashboard.start();
    
    // Connect to Minecraft server
    await botController.connect();
    
    // Push updates to dashboard periodically
    setInterval(() => {
      dashboard.pushUpdate();
    }, 1000);
    
    logger.info('Minehunt AI is now running!');
    logger.info(`Dashboard: http://${process.env.DASHBOARD_HOST || '127.0.0.1'}:${process.env.DASHBOARD_PORT || '50000'}`);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down...');
      botController.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Shutting down...');
      botController.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start Minehunt AI:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the application
main();
