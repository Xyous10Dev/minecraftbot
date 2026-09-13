const mineflayer = require('mineflayer');
const { getConfig } = require('./config');
const { getLogger } = require('./logger');
const { TargetTracker } = require('../perception/targetTracker');
const { DecisionEngine } = require('./decisionEngine');

/**
 * Main bot controller
 * Initializes and manages the Mineflayer bot instance
 */
class BotController {
  constructor() {
    this.config = getConfig();
    this.logger = getLogger();
    
    this.bot = null;
    this.targetTracker = null;
    this.decisionEngine = null;
    
    this.spawnTime = Date.now();
    this.isConnected = false;
    this.isDead = false;
    
    // State for dashboard
    this.status = {
      connected: false,
      health: 20,
      food: 20,
      armor: 0,
      dimension: 'overworld',
      position: { x: 0, y: 0, z: 0 }
    };
  }
  
  /**
   * Initialize and connect the bot
   */
  async connect() {
    try {
      this.logger.info(`Connecting to ${this.config.mcHost}:${this.config.mcPort} as ${this.config.botUsername}`);
      this.logger.info(`Target player: ${this.config.targetPlayer}`);
      this.logger.info(`Minecraft version: ${this.config.mcVersion}`);
      
      const options = {
        host: this.config.mcHost,
        port: this.config.mcPort,
        username: this.config.botUsername,
        version: this.config.mcVersion
      };
      
      this.bot = mineflayer.createBot(options);
      
      // Add reference to config and targetPlayer on bot for other modules
      this.bot.config = this.config;
      this.bot.targetPlayer = this.config.targetPlayer;
      this.bot.spawnTime = this.spawnTime;
      
      this.setupEventListeners();
      
      return new Promise((resolve, reject) => {
        this.bot.once('spawn', () => {
          this.isConnected = true;
          this.status.connected = true;
          this.logger.info('Bot spawned successfully!');
          
          // Initialize subsystems
          this.targetTracker = new TargetTracker(this.bot);
          this.decisionEngine = new DecisionEngine(this.bot, this.targetTracker);
          
          // Start decision loop
          this.startDecisionLoop();
          
          resolve(this.bot);
        });
        
        this.bot.once('error', (err) => {
          this.logger.error('Bot connection error:', err.message);
          reject(err);
        });
        
        this.bot.once('kicked', (reason) => {
          this.logger.error('Bot kicked:', reason);
          this.isConnected = false;
        });
        
        this.bot.once('end', () => {
          this.logger.info('Bot disconnected');
          this.isConnected = false;
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout - is the Minecraft server running?'));
          }
        }, 30000);
      });
    } catch (error) {
      this.logger.error('Failed to create bot:', error.message);
      throw error;
    }
  }
  
  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    this.bot.on('spawn', () => {
      this.logger.info('Spawned at:', this.bot.entity.position);
      this.updateStatus();
    });
    
    this.bot.on('health', () => {
      this.status.health = this.bot.health;
      this.status.food = this.bot.food;
      this.status.foodSaturation = this.bot.foodSaturation;
      
      if (this.bot.health <= 0) {
        this.isDead = true;
        this.decisionEngine?.recordDeath();
        this.logger.error('Bot died!');
      }
      
      this.updateStatus();
    });
    
    this.bot.on('death', () => {
      this.isDead = true;
      this.decisionEngine?.recordDeath();
      this.logger.error('Bot died!');
    });
    
    this.bot.on('respawn', () => {
      this.isDead = false;
      this.logger.info('Bot respawned');
      this.updateStatus();
    });
    
    this.bot.on('move', () => {
      this.updateStatus();
    });
    
    this.bot.on('game', () => {
      this.status.dimension = this.getDimension();
      this.updateStatus();
    });
    
    this.bot.on('chat', (username, message) => {
      this.logger.tagged('CHAT', 'INFO', `${username}: ${message}`);
    });
    
    this.bot.on('kick', (reason) => {
      this.logger.error('Kicked from server:', reason);
      this.isConnected = false;
    });
    
    this.bot.on('error', (err) => {
      this.logger.error('Bot error:', err.message);
    });
  }
  
  /**
   * Get current dimension
   */
  getDimension() {
    if (!this.bot.game) return 'overworld';
    
    if (this.bot.game.dimension === 'minecraft:the_nether') {
      return 'nether';
    } else if (this.bot.game.dimension === 'minecraft:the_end') {
      return 'end';
    }
    return 'overworld';
  }
  
  /**
   * Update status for dashboard
   */
  updateStatus() {
    if (this.bot && this.bot.entity) {
      this.status.position = {
        x: Math.round(this.bot.entity.position.x),
        y: Math.round(this.bot.entity.position.y),
        z: Math.round(this.bot.entity.position.z)
      };
      this.status.dimension = this.getDimension();
    }
    
    this.status.health = this.bot?.health ?? 0;
    this.status.food = this.bot?.food ?? 0;
    this.status.connected = this.isConnected;
  }
  
  /**
   * Start the main decision loop
   */
  startDecisionLoop() {
    // Update decision engine every 200ms
    setInterval(() => {
      if (this.isConnected && !this.isDead && this.decisionEngine) {
        this.decisionEngine.update();
      }
    }, 200);
    
    // Update status periodically
    setInterval(() => {
      this.updateStatus();
    }, 1000);
    
    this.logger.info('Decision loop started');
  }
  
  /**
   * Get full status for dashboard
   */
  getStatus() {
    return {
      ...this.status,
      targetPlayer: this.config.targetPlayer,
      targetInfo: this.targetTracker?.getStatus() || null,
      decisionInfo: this.decisionEngine?.getStatus() || null,
      uptime: Date.now() - this.spawnTime
    };
  }
  
  /**
   * Disconnect the bot
   */
  disconnect() {
    if (this.bot) {
      this.bot.quit();
      this.isConnected = false;
      this.logger.info('Bot disconnected by user request');
    }
  }
}

module.exports = { BotController };
