const { Vec3 } = require('vec3');
const { getLogger } = require('../core/logger');

/**
 * Combat manager for Minehunt AI
 * Handles melee, ranged, and defensive combat tactics
 */
class CombatManager {
  constructor(bot, targetTracker) {
    this.bot = bot;
    this.targetTracker = targetTracker;
    this.logger = getLogger();
    
    this.isInCombat = false;
    this.combatStartTime = null;
    this.lastAttackTime = 0;
    this.attackCooldown = 500; // ms between attacks
    this.preferredWeapon = null;
    this.shieldAvailable = false;
    this.bowAvailable = false;
    this.arrowCount = 0;
    
    this.combatStats = {
      hits: 0,
      misses: 0,
      damageDealt: 0,
      damageReceived: 0,
      kills: 0
    };
    
    this.setupCombatListeners();
  }
  
  setupCombatListeners() {
    // Track health changes (damage received)
    let lastHealth = this.bot.health || 20;
    
    this.bot.on('health', () => {
      const currentHealth = this.bot.health;
      if (currentHealth < lastHealth && this.isInCombat) {
        const damage = lastHealth - currentHealth;
        this.combatStats.damageReceived += damage;
        this.logger.tagged('COMBAT', 'WARN', `Took ${damage} damage! Health: ${currentHealth}`);
      }
      lastHealth = currentHealth;
    });
  }
  
  /**
   * Start combat with the target
   */
  async engageTarget() {
    if (!this.targetTracker.targetPosition) {
      this.logger.tagged('COMBAT', 'ERROR', 'No target to engage!');
      return false;
    }
    
    this.isInCombat = true;
    this.combatStartTime = Date.now();
    this.logger.tagged('COMBAT', 'INFO', 'Engaging target!');
    
    // Equip best weapon
    this.equipBestWeapon();
    
    // Start combat loop
    this.combatLoop();
    
    return true;
  }
  
  /**
   * Main combat loop
   */
  async combatLoop() {
    while (this.isInCombat && this.targetTracker.targetPosition) {
      const distance = this.targetTracker.distance;
      
      // Update combat state
      if (!distance || distance > 64) {
        this.logger.tagged('COMBAT', 'INFO', 'Target too far, disengaging');
        this.isInCombat = false;
        break;
      }
      
      // Melee range
      if (distance <= 4) {
        await this.performMeleeAttack();
      } 
      // Bow range
      else if (distance <= 32 && this.bowAvailable && this.arrowCount > 0) {
        await this.performRangedAttack();
      }
      // Closing distance
      else {
        await this.closeDistance();
      }
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  /**
   * Perform a melee attack
   */
  async performMeleeAttack() {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastAttackTime < this.attackCooldown) {
      return;
    }
    
    const targetEntity = this.getTargetEntity();
    if (!targetEntity) return;
    
    // Look at target
    this.bot.lookAt(targetEntity.position);
    
    // Critical hit by jumping (if on ground)
    if (this.bot.entity.isOnGround) {
      this.bot.setControlState('jump', true);
      setTimeout(() => this.bot.setControlState('jump', false), 100);
    }
    
    // Attack
    try {
      await this.bot.attack(targetEntity);
      this.lastAttackTime = now;
      this.combatStats.hits++;
      this.combatStats.damageDealt += this.getWeaponDamage();
      
      this.logger.tagged('COMBAT', 'DEBUG', 'Melee attack landed!');
      
      // Sprint towards target for knockback
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);
    } catch (error) {
      this.logger.tagged('COMBAT', 'ERROR', 'Attack failed:', error.message);
    }
  }
  
  /**
   * Perform a ranged attack with bow
   */
  async performRangedAttack() {
    if (!this.bowAvailable || this.arrowCount <= 0) return;
    
    const targetEntity = this.getTargetEntity();
    if (!targetEntity) return;
    
    const now = Date.now();
    if (now - this.lastAttackTime < this.attackCooldown * 2) return;
    
    try {
      // Equip bow
      const bowSlot = this.findItemByName('bow');
      if (bowSlot) {
        await this.bot.equip(bowSlot, 'hand');
      }
      
      // Look at target (with some prediction)
      const predictedPos = this.predictTargetPosition(0.5); // 0.5 second prediction
      this.bot.lookAt(predictedPos);
      
      // Draw and release bow (simplified - mineflayer-pvp handles this)
      this.bot.activateItem();
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Charge time
      
      this.bot.deactivateItem();
      
      this.lastAttackTime = now;
      this.arrowCount--;
      this.combatStats.hits++;
      
      this.logger.tagged('COMBAT', 'DEBUG', `Arrow fired! Arrows remaining: ${this.arrowCount}`);
    } catch (error) {
      this.logger.tagged('COMBAT', 'ERROR', 'Ranged attack failed:', error.message);
    }
  }
  
  /**
   * Close distance to target
   */
  async closeDistance() {
    const targetPos = this.targetTracker.targetPosition;
    if (!targetPos) return;
    
    // Sprint towards target
    this.bot.lookAt(targetPos);
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    
    // Strafe to avoid being an easy target
    const strafeDirection = Math.random() > 0.5 ? 'left' : 'right';
    this.bot.setControlState(strafeDirection, true);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.bot.setControlState(strafeDirection, false);
  }
  
  /**
   * Get target entity
   */
  getTargetEntity() {
    const player = this.bot.players[this.bot.targetPlayer];
    if (player) {
      return this.bot.entities[player.entityId];
    }
    return null;
  }
  
  /**
   * Predict target position based on velocity
   */
  predictTargetPosition(seconds) {
    if (!this.targetTracker.targetVelocity) {
      return this.targetTracker.targetPosition;
    }
    
    return this.targetTracker.targetPosition.clone().add(
      this.targetTracker.targetVelocity.scale(seconds)
    );
  }
  
  /**
   * Equip the best available weapon
   */
  equipBestWeapon() {
    // Priority: Diamond Sword > Iron Sword > Stone Sword > Wooden Sword > Axe
    
    const weapons = [
      'diamond_sword',
      'iron_sword',
      'stone_sword',
      'golden_sword',
      'wooden_sword',
      'diamond_axe',
      'iron_axe',
      'stone_axe'
    ];
    
    for (const weapon of weapons) {
      const slot = this.findItemByName(weapon);
      if (slot) {
        this.bot.equip(slot, 'hand')
          .then(() => {
            this.preferredWeapon = weapon;
            this.logger.tagged('COMBAT', 'INFO', `Equipped ${weapon}`);
          })
          .catch(err => {
            this.logger.tagged('COMBAT', 'WARN', `Failed to equip ${weapon}:`, err.message);
          });
        return true;
      }
    }
    
    this.logger.tagged('COMBAT', 'WARN', 'No weapon found, using fists');
    return false;
  }
  
  /**
   * Find item in inventory by name
   */
  findItemByName(name) {
    const items = this.bot.inventory.items();
    return items.find(item => item.name === name);
  }
  
  /**
   * Get weapon damage value
   */
  getWeaponDamage() {
    const damageValues = {
      'diamond_sword': 7,
      'iron_sword': 6,
      'stone_sword': 5,
      'golden_sword': 4,
      'wooden_sword': 4,
      'diamond_axe': 9,
      'iron_axe': 8,
      'stone_axe': 7,
      'fist': 1
    };
    
    return damageValues[this.preferredWeapon] || damageValues['fist'];
  }
  
  /**
   * Use shield for defense
   */
  async useShield(enable) {
    const shield = this.findItemByName('shield');
    if (!shield) return false;
    
    try {
      if (enable) {
        await this.bot.equip(shield, 'off-hand');
        this.bot.activateItem();
        this.logger.tagged('COMBAT', 'DEBUG', 'Shield raised');
      } else {
        this.bot.deactivateItem();
        this.logger.tagged('COMBAT', 'DEBUG', 'Shield lowered');
      }
      return true;
    } catch (error) {
      this.logger.tagged('COMBAT', 'ERROR', 'Shield usage failed:', error.message);
      return false;
    }
  }
  
  /**
   * Retreat from combat
   */
  async retreat(direction) {
    this.logger.tagged('COMBAT', 'INFO', 'Retreating from combat');
    
    this.isInCombat = false;
    this.bot.setControlState('sprint', true);
    
    // Move away from target
    if (this.targetTracker.targetPosition) {
      const awayDir = this.bot.entity.position.minus(this.targetTracker.targetPosition).normalize();
      const retreatPos = this.bot.entity.position.plus(awayDir.scale(20));
      
      this.bot.lookAt(retreatPos);
      this.bot.setControlState('forward', true);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.bot.setControlState('forward', false);
    this.bot.setControlState('sprint', false);
  }
  
  /**
   * Record a kill
   */
  recordKill() {
    this.combatStats.kills++;
    this.isInCombat = false;
    this.logger.tagged('COMBAT', 'INFO', 'Target eliminated!');
  }
  
  /**
   * Stop combat
   */
  stopCombat() {
    this.isInCombat = false;
    this.bot.setControlState('forward', false);
    this.bot.setControlState('backward', false);
    this.bot.setControlState('left', false);
    this.bot.setControlState('right', false);
    this.bot.setControlState('sprint', false);
    this.bot.deactivateItem();
  }
  
  getStatus() {
    return {
      isInCombat: this.isInCombat,
      preferredWeapon: this.preferredWeapon,
      bowAvailable: this.bowAvailable,
      arrowCount: this.arrowCount,
      stats: this.combatStats,
      combatDuration: this.combatStartTime ? Date.now() - this.combatStartTime : 0
    };
  }
}

module.exports = { CombatManager };
