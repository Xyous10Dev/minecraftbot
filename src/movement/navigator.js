const { Vec3 } = require('vec3');
const { getLogger } = require('../core/logger');

/**
 * Advanced navigation system using mineflayer-pathfinder
 * Handles pathfinding, movement, and obstacle avoidance
 */
class Navigator {
  constructor(bot) {
    this.bot = bot;
    this.logger = getLogger();
    
    this.pathfinder = null;
    this.goal = null;
    this.isMoving = false;
    this.currentPath = null;
    this.pathFailures = 0;
    this.lastPosition = null;
    this.stuckCounter = 0;
    
    this.setupPathfinder();
  }
  
  setupPathfinder() {
    try {
      const { pathfinder, Movements, goals: { GoalNear, GoalXZ, GoalNear3D } } = require('mineflayer-pathfinder');
      const pf = require('mineflayer-pathfinder');
      
      this.bot.loadPlugin(pathfinder);
      
      const defaultMove = new Movements(this.bot, require('minecraft-data')(this.bot.version));
      this.bot.pathfinder.setMovements(defaultMove);
      
      this.GoalNear = GoalNear;
      this.GoalXZ = GoalXZ;
      this.GoalNear3D = GoalNear3D;
      
      this.logger.tagged('NAV', 'INFO', 'Pathfinder loaded successfully');
    } catch (error) {
      this.logger.tagged('NAV', 'ERROR', 'Failed to load pathfinder:', error.message);
      this.logger.tagged('NAV', 'WARN', 'Navigation will use basic movement only');
    }
    
    // Setup pathfinder events
    this.bot.on('path_update', (result) => {
      if (result.status === 'noPath') {
        this.pathFailures++;
        this.logger.tagged('NAV', 'WARN', 'No path found to goal');
        this.isMoving = false;
      }
    });
  }
  
  /**
   * Navigate to a specific position
   */
  async goTo(x, y, z, options = {}) {
    if (!this.pathfinder) {
      return this.basicMoveTo(x, y, z);
    }
    
    const range = options.range || 1;
    const timeout = options.timeout || 30000;
    
    try {
      const goal = new this.GoalNear(x, y, z, range);
      
      await this.bot.pathfinder.goto(goal, timeout);
      
      this.logger.tagged('NAV', 'DEBUG', `Reached destination: ${x}, ${y}, ${z}`);
      this.pathFailures = 0;
      return true;
    } catch (error) {
      this.logger.tagged('NAV', 'ERROR', `Navigation failed: ${error.message}`);
      this.pathFailures++;
      return false;
    }
  }
  
  /**
   * Navigate to XZ coordinates only (any Y)
   */
  async goToXZ(x, z, yRange = 10) {
    if (!this.pathfinder) {
      return this.basicMoveTo(x, this.bot.entity.position.y, z);
    }
    
    try {
      const goal = new this.GoalXZ(x, z);
      await this.bot.pathfinder.goto(goal);
      return true;
    } catch (error) {
      this.logger.tagged('NAV', 'ERROR', `XZ navigation failed: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Basic movement without pathfinder (fallback)
   */
  async basicMoveTo(x, y, z) {
    const target = new Vec3(x, y, z);
    const current = this.bot.entity.position;
    const direction = target.minus(current).normalize();
    
    // Simple approach - walk in direction
    const maxIterations = 100;
    let iterations = 0;
    
    while (current.distanceTo(target) > 2 && iterations < maxIterations) {
      const nextPos = current.plus(direction);
      
      // Check if block ahead is solid
      const block = this.bot.blockAt(nextPos);
      if (block && block.boundingBox === 'block') {
        // Try jumping
        this.bot.setControlState('jump', true);
        setTimeout(() => this.bot.setControlState('jump', false), 500);
      }
      
      this.bot.lookAt(target);
      this.bot.setControlState('forward', true);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      iterations++;
    }
    
    this.bot.setControlState('forward', false);
    return true;
  }
  
  /**
   * Stop current movement
   */
  stop() {
    if (this.pathfinder) {
      this.bot.pathfinder.stop();
    }
    this.bot.setControlState('forward', false);
    this.bot.setControlState('backward', false);
    this.bot.setControlState('left', false);
    this.bot.setControlState('right', false);
    this.isMoving = false;
  }
  
  /**
   * Sprint towards a direction
   */
  sprintTowards(x, y, z) {
    const target = new Vec3(x, y, z);
    this.bot.lookAt(target);
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
  }
  
  /**
   * Check if bot is stuck
   */
  checkStuck() {
    const currentPos = this.bot.entity.position;
    
    if (this.lastPosition) {
      const distance = currentPos.distanceTo(this.lastPosition);
      
      if (distance < 0.5) {
        this.stuckCounter++;
        if (this.stuckCounter > 10) {
          this.logger.tagged('NAV', 'WARN', 'Bot appears to be stuck!');
          this.stuckCounter = 0;
          return true;
        }
      } else {
        this.stuckCounter = 0;
      }
    }
    
    this.lastPosition = currentPos.clone();
    return false;
  }
  
  /**
   * Attempt to recover from being stuck
   */
  async recoverFromStuck() {
    this.logger.tagged('NAV', 'INFO', 'Attempting recovery from stuck state');
    
    // Stop movement
    this.stop();
    
    // Try jumping
    this.bot.setControlState('jump', true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.bot.setControlState('jump', false);
    
    // Look around
    this.bot.yaw += Math.PI / 4;
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Try moving backward
    this.bot.setControlState('backward', true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.bot.setControlState('backward', false);
    
    return true;
  }
  
  /**
   * Bridge across a gap
   */
  async bridge(distance, direction) {
    this.logger.tagged('NAV', 'INFO', `Bridging ${distance} blocks ${direction}`);
    
    // This would need implementation with block placement
    // Placeholder for future implementation
    return false;
  }
  
  /**
   * Climb up or down
   */
  async climb(verticalDistance, up = true) {
    this.logger.tagged('NAV', 'INFO', `Climbing ${verticalDistance} blocks ${up ? 'up' : 'down'}`);
    
    for (let i = 0; i < verticalDistance; i++) {
      if (up) {
        this.bot.setControlState('jump', true);
        await new Promise(resolve => setTimeout(resolve, 300));
        this.bot.setControlState('jump', false);
      } else {
        // Move down carefully
        this.bot.setControlState('sneak', true);
        await new Promise(resolve => setTimeout(resolve, 200));
        this.bot.setControlState('sneak', false);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return true;
  }
  
  getStatus() {
    return {
      isMoving: this.isMoving,
      pathFailures: this.pathFailures,
      hasPathfinder: !!this.pathfinder,
      stuckCount: this.stuckCounter
    };
  }
}

module.exports = { Navigator };
