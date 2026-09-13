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
    
    this.spawnTime = null; // Will be set on actual spawn
    this.isConnected = false;
    this.isDead = false;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseReconnectDelay = 2000; // 2 seconds base delay
    
    // State for dashboard
    this.status = {
      connected: false,
      health: 20,
      food: 20,
      foodItemsAvailable: false, // Track if we have edible food
      armor: 0,
      dimension: 'overworld',
      position: { x: 0, y: 0, z: 0 }
    };
  }
  
  /**
   * Initialize and connect the bot with smart retry logic
   */
  async connect() {
    const maxAttempts = this.maxReconnectAttempts;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.connectionAttempts = attempt;
        
        // Clear port confusion - explicitly log both ports
        this.logger.info('╔════════════════════════════════════════════════════╗');
        this.logger.info(`║  Minecraft Server: ${this.config.mcHost}:${String(this.config.mcPort).padEnd(5)}                     ║`);
        this.logger.info(`║  Dashboard:        http://${this.config.dashboardHost}:${String(this.config.dashboardPort).padEnd(5)}                ║`);
        this.logger.info(`║  Target Player:    ${this.config.targetPlayer.padEnd(20)}                     ║`);
        this.logger.info(`║  Minecraft Version: ${this.config.mcVersion.padEnd(18)}                     ║`);
        this.logger.info('╚════════════════════════════════════════════════════╝');
        
        const options = {
          host: this.config.mcHost,
          port: this.config.mcPort,
          username: this.config.botUsername,
          version: this.config.mcVersion
        };
        
        this.logger.info(`Connecting to Minecraft server at ${options.host}:${options.port}... (Attempt ${attempt}/${maxAttempts})`);
        
        this.bot = mineflayer.createBot(options);
        
        // Add reference to config and targetPlayer on bot for other modules
        this.bot.config = this.config;
        this.bot.targetPlayer = this.config.targetPlayer;
        // spawnTime will be set when actually spawned
        
        this.setupEventListeners();
        
        await new Promise((resolve, reject) => {
          let spawnResolved = false;
          
          this.bot.once('spawn', () => {
            if (spawnResolved) return;
            spawnResolved = true;
            
            this.isConnected = true;
            this.status.connected = true;
            this.spawnTime = Date.now(); // Set spawn time on actual spawn
            this.bot.spawnTime = this.spawnTime;
            
            this.logger.info('✓ Bot spawned successfully!');
            this.logger.info(`  Spawn position: ${this.bot.entity.position.x}, ${this.bot.entity.position.y}, ${this.bot.entity.position.z}`);
            
            // Initialize subsystems AFTER spawn
            this.targetTracker = new TargetTracker(this.bot);
            this.decisionEngine = new DecisionEngine(this.bot, this.targetTracker);
            
            // Start decision loop
            this.startDecisionLoop();
            
            resolve(this.bot);
          });
          
          this.bot.once('error', (err) => {
            if (spawnResolved) return;
            spawnResolved = true;
            
            const errorMsg = err.message || 'Unknown connection error';
            
            // Handle specific connection errors
            if (errorMsg.includes('ECONNREFUSED')) {
              this.logger.error(`✗ Connection refused: No Minecraft server found at ${options.host}:${options.port}`);
              this.logger.error('  Please ensure:');
              this.logger.error('  1. A Minecraft Java Edition server is running');
              this.logger.error(`  2. The server is listening on port ${options.port}`);
              this.logger.error('  3. Check your .env file MC_HOST and MC_PORT settings');
            } else if (errorMsg.includes('ETIMEDOUT')) {
              this.logger.error(`✗ Connection timed out: Server at ${options.host}:${options.port} is not responding`);
            } else if (errorMsg.includes('ENOTFOUND')) {
              this.logger.error(`✗ Host not found: ${options.host}`);
              this.logger.error('  Check your MC_HOST setting in .env');
            } else {
              this.logger.error('✗ Bot connection error:', errorMsg);
            }
            
            reject(err);
          });
          
          this.bot.once('kicked', (reason) => {
            if (spawnResolved) return;
            spawnResolved = true;
            
            this.logger.error('✗ Bot kicked from server:', reason);
            this.isConnected = false;
            reject(new Error(`Kicked: ${reason}`));
          });
          
          // Timeout after 15 seconds per attempt
          setTimeout(() => {
            if (!spawnResolved) {
              spawnResolved = true;
              this.logger.warn(`⚠ Connection attempt ${attempt} timed out after 15 seconds`);
              reject(new Error('Connection timeout'));
            }
          }, 15000);
        });
        
        // If we reach here, connection was successful
        return this.bot;
        
      } catch (error) {
        this.logger.error(`Connection attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxAttempts) {
          const delay = this.baseReconnectDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.info(`Retrying in ${Math.round(delay / 1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.logger.error('╔════════════════════════════════════════════════════╗');
          this.logger.error('║  MAXIMUM CONNECTION ATTEMPTS REACHED               ║');
          this.logger.error('╚════════════════════════════════════════════════════╝');
          this.logger.error('');
          this.logger.error('Troubleshooting steps:');
          this.logger.error('1. Start a Minecraft Java Edition 1.20.1 server');
          this.logger.error(`2. Ensure it's running on localhost:${this.config.mcPort}`);
          this.logger.error('3. Check firewall settings');
          this.logger.error('4. Verify .env configuration');
          this.logger.error('');
          this.logger.error('Then run: npm start');
          throw new Error('Failed to connect to Minecraft server after multiple attempts');
        }
      }
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
    this.status.foodSaturation = this.bot?.foodSaturation ?? 0;
    this.status.connected = this.isConnected;
    
    // Check if we have edible food in inventory
    this.checkFoodAvailability();
  }
  
  /**
   * Check if bot has edible food items in inventory
   */
  checkFoodAvailability() {
    if (!this.bot || !this.bot.inventory) {
      this.status.foodItemsAvailable = false;
      return;
    }
    
    // List of edible items in Minecraft 1.20.1
    const edibleItems = [
      'apple', 'golden_apple', 'enchanted_golden_apple',
      'bread', 'cooked_beef', 'raw_beef', 'cooked_porkchop', 'raw_porkchop',
      'cooked_chicken', 'raw_chicken', 'cooked_mutton', 'raw_mutton',
      'cooked_rabbit', 'raw_rabbit', 'cooked_cod', 'raw_cod',
      'cooked_salmon', 'raw_salmon', 'tropical_fish', 'pufferfish',
      'carrot', 'golden_carrot', 'potato', 'baked_potato', 'poisonous_potato',
      'beetroot', 'dried_kelp', 'sweet_berries', 'glow_berries',
      'melon_slice', 'chorus_fruit', 'cookie', 'cake', 'pumpkin_pie',
      'rabbit_stew', 'beetroot_soup', 'mushroom_stew', 'suspicious_stew'
    ];
    
    let hasEdibleFood = false;
    
    // Check inventory slots
    for (let i = 0; i < this.bot.inventory.slots.length; i++) {
      const item = this.bot.inventory.slots[i];
      if (item && edibleItems.includes(item.name)) {
        hasEdibleFood = true;
        break;
      }
    }
    
    this.status.foodItemsAvailable = hasEdibleFood;
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
      uptime: Date.now() - (this.spawnTime || Date.now()),
      connectionAttempts: this.connectionAttempts
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
