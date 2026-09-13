require('dotenv').config();

/**
 * Configuration manager for Minehunt AI
 * All important settings are loaded from environment variables
 */
class Config {
  constructor() {
    // Minecraft Server
    this.mcHost = process.env.MC_HOST || 'localhost';
    this.mcPort = parseInt(process.env.MC_PORT, 10) || 25565;
    this.mcVersion = process.env.MC_VERSION || '1.20.1';
    
    // Bot Configuration
    this.botUsername = process.env.BOT_USERNAME || 'MinehuntAI';
    this.targetPlayer = process.env.TARGET_PLAYER || 'mr_xyous';
    
    // Timing Configuration
    this.preparationSeconds = parseInt(process.env.PREPARATION_SECONDS, 10) || 60;
    this.targetRespawnWindowSeconds = parseInt(process.env.TARGET_RESPAWN_WINDOW_SECONDS, 10) || 300;
    
    // Dashboard Configuration
    this.dashboardHost = process.env.DASHBOARD_HOST || '127.0.0.1';
    this.dashboardPort = parseInt(process.env.DASHBOARD_PORT, 10) || 50000;
    
    // Mode: development, survival, benchmark
    this.mode = process.env.MODE || 'development';
    
    // Logging
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    
    // Validate configuration
    this.validate();
  }
  
  validate() {
    const validModes = ['development', 'survival', 'benchmark'];
    if (!validModes.includes(this.mode)) {
      throw new Error(`Invalid mode: ${this.mode}. Must be one of: ${validModes.join(', ')}`);
    }
    
    if (this.preparationSeconds < 0) {
      throw new Error('PREPARATION_SECONDS must be non-negative');
    }
    
    if (this.targetRespawnWindowSeconds < 0) {
      throw new Error('TARGET_RESPAWN_WINDOW_SECONDS must be non-negative');
    }
    
    if (this.mcPort < 1 || this.mcPort > 65535) {
      throw new Error('MC_PORT must be between 1 and 65535');
    }
    
    if (this.dashboardPort < 1 || this.dashboardPort > 65535) {
      throw new Error('DASHBOARD_PORT must be between 1 and 65535');
    }
  }
  
  /**
   * Check if running in development mode
   */
  isDevelopment() {
    return this.mode === 'development';
  }
  
  /**
   * Check if running in survival mode
   */
  isSurvival() {
    return this.mode === 'survival';
  }
  
  /**
   * Check if running in benchmark mode
   */
  isBenchmark() {
    return this.mode === 'benchmark';
  }
  
  /**
   * Get server options for mineflayer
   */
  getServerOptions() {
    return {
      host: this.mcHost,
      port: this.mcPort,
      username: this.botUsername,
      version: this.mcVersion
    };
  }
}

// Singleton instance
let configInstance = null;

function getConfig() {
  if (!configInstance) {
    configInstance = new Config();
  }
  return configInstance;
}

module.exports = { Config, getConfig };
