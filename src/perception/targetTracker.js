const { getLogger } = require('./logger');
const { BotState, Priority } = require('./stateMachine');

/**
 * Target tracking system
 * Maintains live state of the target player
 */
class TargetTracker {
  constructor(bot) {
    this.bot = bot;
    this.logger = getLogger();
    
    // Target state
    this.targetPosition = null;
    this.targetVelocity = null;
    this.targetDimension = 'overworld';
    this.distance = null;
    this.lastSeenPosition = null;
    this.lastSeenTime = null;
    this.estimatedDirection = null;
    this.estimatedRoute = [];
    this.estimatedProgression = 'early';
    
    // Search memory
    this.searchedAreas = new Set();
    this.lastKnownBiome = null;
    
    // Player model tendencies
    this.playerModel = {
      preferredDirection: null,
      aggressionLevel: 0.5,
      tendencyToRun: 0.5,
      prefersCaves: false,
      rushesNether: false,
      seeksVillages: false,
      speedrunBehavior: false
    };
    
    this.setupListeners();
  }
  
  setupListeners() {
    this.bot.on('playerJoined', (player) => {
      if (player.username === this.bot.targetPlayer) {
        this.logger.tagged('TRACK', 'INFO', `Target detected: ${player.username}`);
        this.updateTargetInfo(player);
      }
    });
    
    this.bot.on('playerLeft', (player) => {
      if (player.username === this.bot.targetPlayer) {
        this.logger.tagged('TRACK', 'INFO', `Target left: ${player.username}`);
        this.lastSeenTime = Date.now();
      }
    });
    
    // Periodic position updates
    setInterval(() => this.updateTracking(), 500);
  }
  
  updateTargetInfo(player) {
    const entity = this.bot.entities[player.entityId];
    if (entity && entity.position) {
      this.targetPosition = entity.position.clone();
      this.lastSeenPosition = entity.position.clone();
      this.lastSeenTime = Date.now();
      
      // Calculate distance
      if (this.bot.entity) {
        this.distance = this.bot.entity.position.distanceTo(this.targetPosition);
      }
      
      // Track dimension
      this.targetDimension = this.getDimension();
      
      this.logger.tagged('TRACK', 'DEBUG', `Target position: ${this.targetPosition.x.toFixed(1)}, ${this.targetPosition.y.toFixed(1)}, ${this.targetPosition.z.toFixed(1)}`);
      this.logger.tagged('TRACK', 'DEBUG', `Distance: ${this.distance?.toFixed(1) ?? 'unknown'} blocks`);
    }
  }
  
  updateTracking() {
    const player = this.bot.players[this.bot.targetPlayer];
    if (player) {
      this.updateTargetInfo(player);
      
      // Update velocity if we have previous position
      const entity = this.bot.entities[player.entityId];
      if (entity && entity.position && this.lastSeenPosition) {
        this.targetVelocity = entity.position.minus(this.lastSeenPosition);
        
        // Update direction estimation
        if (this.targetVelocity.length() > 0.1) {
          this.estimatedDirection = this.targetVelocity.clone().normalize();
          this.playerModel.preferredDirection = this.estimatedDirection;
        }
      }
    }
  }
  
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
   * Check if target is within engagement range
   */
  isTargetInEngagementRange(range = 32) {
    return this.distance !== null && this.distance <= range;
  }
  
  /**
   * Check if target is close enough for melee combat
   */
  isTargetInMeleeRange() {
    return this.distance !== null && this.distance <= 4;
  }
  
  /**
   * Get time since target was last seen
   */
  getTimeSinceLastSeen() {
    if (!this.lastSeenTime) return Infinity;
    return Date.now() - this.lastSeenTime;
  }
  
  /**
   * Estimate target progression based on observations
   */
  estimateProgression() {
    // This would be enhanced with actual item observations
    const timeSinceSpawn = Date.now() - this.bot.spawnTime;
    
    if (timeSinceSpawn < 60000) { // First minute
      this.estimatedProgression = 'very_early';
    } else if (timeSinceSpawn < 300000) { // First 5 minutes
      this.estimatedProgression = 'early';
    } else if (timeSinceSpawn < 600000) { // First 10 minutes
      this.estimatedProgression = 'mid';
    } else {
      this.estimatedProgression = 'late';
    }
    
    return this.estimatedProgression;
  }
  
  /**
   * Predict likely next locations for target
   */
  predictNextLocations() {
    const predictions = [];
    
    if (this.lastSeenPosition) {
      // Continue in last known direction
      if (this.estimatedDirection) {
        predictions.push({
          position: this.lastSeenPosition.clone().add(this.estimatedDirection.scale(20)),
          confidence: 0.6
        });
      }
      
      // Nearby high-value locations could be added here
      // (villages, structures, resources)
    }
    
    return predictions;
  }
  
  /**
   * Mark an area as searched
   */
  markAreaSearched(x, z, radius = 16) {
    const key = `${Math.floor(x / radius)},${Math.floor(z / radius)}`;
    this.searchedAreas.add(key);
  }
  
  /**
   * Check if an area has been searched
   */
  isAreaSearched(x, z, radius = 16) {
    const key = `${Math.floor(x / radius)},${Math.floor(z / radius)}`;
    return this.searchedAreas.has(key);
  }
  
  /**
   * Get current target state for dashboard
   */
  getStatus() {
    return {
      username: this.bot.targetPlayer,
      position: this.targetPosition ? {
        x: this.targetPosition.x,
        y: this.targetPosition.y,
        z: this.targetPosition.z
      } : null,
      dimension: this.targetDimension,
      distance: this.distance,
      lastSeen: this.lastSeenTime,
      estimatedProgression: this.estimatedProgression,
      timeSinceLastSeen: this.getTimeSinceLastSeen()
    };
  }
}

module.exports = { TargetTracker };
