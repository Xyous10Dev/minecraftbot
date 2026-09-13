const { getLogger } = require('../core/logger');
const { BotState, Priority } = require('../core/stateMachine');

/**
 * Decision engine - the brain of Minehunt AI
 * Evaluates situation and selects optimal actions
 */
class DecisionEngine {
  constructor(bot, targetTracker) {
    this.bot = bot;
    this.targetTracker = targetTracker;
    this.logger = getLogger();
    
    this.currentState = BotState.INITIALIZING;
    this.currentTask = 'Initializing system';
    this.currentPriority = Priority.LOW;
    
    // Timing
    this.preparationStartTime = null;
    this.targetDeathTime = null;
    this.lastDecisionTime = Date.now();
    
    // Telemetry for self-improvement
    this.telemetry = {
      decisions: [],
      combatEvents: [],
      deaths: 0,
      kills: 0,
      resourcesGathered: 0,
      pathsCalculated: 0,
      pathFailures: 0
    };
    
    // Strategy weights (configurable)
    this.strategyWeights = {
      survival: 1.0,
      tracking: 0.9,
      progression: 0.8,
      combat: 0.85,
      upgrading: 0.7
    };
  }
  
  /**
   * Main decision loop - called periodically
   */
  update() {
    const now = Date.now();
    this.lastDecisionTime = now;
    
    // Check for emergency situations first
    if (this.checkEmergency()) {
      return;
    }
    
    // Evaluate current situation
    const newState = this.evaluateState();
    
    if (newState !== this.currentState) {
      this.transitionTo(newState);
    }
    
    // Update current task based on state
    this.updateCurrentTask();
  }
  
  /**
   * Check for emergency situations that override all other logic
   */
  checkEmergency() {
    const preparationElapsed = this.preparationStartTime 
      ? (Date.now() - this.preparationStartTime) / 1000 
      : Infinity;
    
    const isInPreparation = preparationElapsed < this.bot.config.preparationSeconds;
    
    // Low health emergency (always applies)
    if (this.bot.health && this.bot.health < 6) {
      if (this.currentState !== BotState.EMERGENCY && 
          this.currentState !== BotState.RETREAT &&
          this.currentState !== BotState.RECOVERY) {
        this.logger.tagged('DECISION', 'WARN', 'Emergency: Low health!');
        this.transitionTo(BotState.EMERGENCY);
        return true;
      }
    }
    
    // CRITICAL: During preparation phase, do NOT initiate combat
    // Only defend if directly attacked (target hits us first)
    if (isInPreparation) {
      // Don't start hunting during preparation
      if (this.currentState === BotState.GATHERING ||
          this.currentState === BotState.UPGRADING ||
          this.currentState === BotState.NETHER_PROGRESS) {
        
        // Only interrupt if target is VERY close AND aggressive
        // Otherwise continue preparation
        if (this.targetTracker.isTargetInMeleeRange() && 
            this.targetTracker.getTimeSinceLastSeen() < 1000) {
          // Target is right here - might need to defend
          // But still prefer to avoid engagement during prep
          this.logger.tagged('DECISION', 'INFO', 'Target nearby during preparation - avoiding engagement');
          // Don't transition to intercept, stay in preparation
        }
        return false; // Don't interrupt preparation
      }
    }
    
    // After preparation: Target appears during non-combat state
    if (!isInPreparation && 
        this.targetTracker.isTargetInEngagementRange(16) &&
        (this.currentState === BotState.GATHERING ||
         this.currentState === BotState.UPGRADING ||
         this.currentState === BotState.NETHER_PROGRESS)) {
      this.logger.tagged('DECISION', 'INFO', 'Target spotted! Interrupting current task.');
      this.transitionTo(BotState.INTERCEPTING);
      return true;
    }
    
    return false;
  }
  
  /**
   * Evaluate which state we should be in
   */
  evaluateState() {
    const preparationElapsed = this.preparationStartTime 
      ? (Date.now() - this.preparationStartTime) / 1000 
      : 0;
    
    const targetDeadElapsed = this.targetDeathTime
      ? (Date.now() - this.targetDeathTime) / 1000
      : Infinity;
    
    // Five-minute upgrade window after target death (takes priority)
    if (this.targetDeathTime && targetDeadElapsed < this.bot.config.targetRespawnWindowSeconds) {
      return BotState.FIVE_MINUTE_UPGRADE;
    } else if (this.targetDeathTime && targetDeadElapsed >= this.bot.config.targetRespawnWindowSeconds) {
      this.targetDeathTime = null;
      this.logger.tagged('DECISION', 'INFO', 'Upgrade window complete. Resuming hunt.');
    }
    
    // CRITICAL: Preparation phase (first 60 seconds) - NO HUNTING
    if (!this.preparationStartTime) {
      this.preparationStartTime = Date.now();
      return BotState.PREPARATION;
    }
    
    if (preparationElapsed < this.bot.config.preparationSeconds) {
      // During preparation, only gather/craft, never hunt
      // Exception: self-defense if attacked
      return BotState.PREPARATION;
    }
    
    // After preparation period ends, normal hunting logic applies
    
    // Check if target is currently visible
    if (this.targetTracker.lastSeenPosition && 
        this.targetTracker.getTimeSinceLastSeen() < 3000) {
      
      if (this.targetTracker.isTargetInMeleeRange()) {
        return BotState.COMBAT;
      }
      
      if (this.targetTracker.isTargetInEngagementRange()) {
        return BotState.CHASE;
      }
    }
    
    // Target is far or not recently seen - intercept or search
    if (this.targetTracker.lastSeenPosition) {
      return BotState.INTERCEPTING;
    }
    
    // No target info - search
    return BotState.SEARCHING;
  }
  
  /**
   * Transition to a new state
   */
  transitionTo(newState) {
    const oldState = this.currentState;
    this.currentState = newState;
    
    this.logger.tagged('STATE', 'INFO', `Transition: ${oldState} → ${newState}`);
    
    // Log telemetry
    this.telemetry.decisions.push({
      timestamp: Date.now(),
      fromState: oldState,
      toState: newState,
      reason: this.currentTask
    });
    
    // Keep only last 100 decisions
    if (this.telemetry.decisions.length > 100) {
      this.telemetry.decisions.shift();
    }
    
    // State entry actions
    this.onStateEnter(newState);
  }
  
  /**
   * Actions to perform when entering a state
   */
  onStateEnter(state) {
    switch (state) {
      case BotState.PREPARATION:
        this.currentTask = 'Gathering essential resources';
        this.currentPriority = Priority.HIGH;
        break;
        
      case BotState.COMBAT:
        this.currentTask = 'Engaging target';
        this.currentPriority = Priority.CRITICAL;
        break;
        
      case BotState.CHASE:
        this.currentTask = 'Pursuing target';
        this.currentPriority = Priority.HIGH;
        break;
        
      case BotState.INTERCEPTING:
        this.currentTask = 'Calculating interception route';
        this.currentPriority = Priority.HIGH;
        break;
        
      case BotState.TARGET_DEAD:
      case BotState.FIVE_MINUTE_UPGRADE:
        this.currentTask = 'Upgrading equipment';
        this.currentPriority = Priority.MEDIUM;
        break;
        
      case BotState.SEARCHING:
        this.currentTask = 'Locating target';
        this.currentPriority = Priority.MEDIUM;
        break;
        
      case BotState.EMERGENCY:
        this.currentTask = 'Survival critical';
        this.currentPriority = Priority.CRITICAL;
        break;
        
      default:
        this.currentTask = 'Evaluating options';
        this.currentPriority = Priority.LOW;
    }
  }
  
  /**
   * Update current task description
   */
  updateCurrentTask() {
    // Override task based on specific conditions
    switch (this.currentState) {
      case BotState.PREPARATION:
        const prepElapsed = (Date.now() - this.preparationStartTime) / 1000;
        const prepRemaining = Math.max(0, this.bot.config.preparationSeconds - prepElapsed);
        this.currentTask = `Preparation (${Math.ceil(prepRemaining)}s remaining)`;
        break;
        
      case BotState.FIVE_MINUTE_UPGRADE:
        const upgradeElapsed = (Date.now() - this.targetDeathTime) / 1000;
        const upgradeRemaining = Math.max(0, this.bot.config.targetRespawnWindowSeconds - upgradeElapsed);
        this.currentTask = `Upgrade window (${Math.ceil(upgradeRemaining)}s remaining)`;
        break;
    }
  }
  
  /**
   * Calculate resource priority score
   */
  calculateResourceScore(item) {
    // Base scores for common items
    const baseScores = {
      'diamond': 100,
      'iron_ingot': 50,
      'gold_ingot': 30,
      'emerald': 25,
      'coal': 20,
      'stick': 5,
      'wood': 10,
      'stone': 8,
      'cobblestone': 8,
      'food': 30,
      'arrow': 15,
      'ender_pearl': 80,
      'blaze_rod': 60,
      'obsidian': 40
    };
    
    let score = baseScores[item] || 5;
    
    // Modify based on current state
    if (this.currentState === BotState.COMBAT || this.currentState === BotState.CHASE) {
      if (['arrow', 'bow', 'sword', 'food'].includes(item)) {
        score *= 2;
      }
    }
    
    if (this.currentState === BotState.FIVE_MINUTE_UPGRADE) {
      if (['diamond', 'iron_ingot', 'obsidian', 'ender_pearl', 'blaze_rod'].includes(item)) {
        score *= 1.5;
      }
    }
    
    return score;
  }
  
  /**
   * Get current status for dashboard
   */
  getStatus() {
    const preparationElapsed = this.preparationStartTime 
      ? (Date.now() - this.preparationStartTime) / 1000 
      : 0;
    
    const prepRemaining = Math.max(0, this.bot.config.preparationSeconds - preparationElapsed);
    
    return {
      currentState: this.currentState,
      currentTask: this.currentTask,
      currentPriority: this.currentPriority,
      preparationTime: preparationElapsed,
      preparationRemaining: prepRemaining,
      isInPreparation: preparationElapsed < this.bot.config.preparationSeconds,
      targetDeathTime: this.targetDeathTime,
      lastDecision: this.lastDecisionTime,
      telemetry: {
        totalDecisions: this.telemetry.decisions.length,
        deaths: this.telemetry.deaths,
        kills: this.telemetry.kills
      }
    };
  }
  
  /**
   * Record a combat event for telemetry
   */
  recordCombatEvent(event) {
    this.telemetry.combatEvents.push({
      timestamp: Date.now(),
      ...event
    });
    
    // Keep only last 50 combat events
    if (this.telemetry.combatEvents.length > 50) {
      this.telemetry.combatEvents.shift();
    }
  }
  
  /**
   * Record a kill
   */
  recordKill() {
    this.telemetry.kills++;
    this.logger.tagged('COMBAT', 'INFO', 'Target eliminated!');
    this.targetDeathTime = Date.now();
  }
  
  /**
   * Record a death
   */
  recordDeath() {
    this.telemetry.deaths++;
    this.logger.tagged('COMBAT', 'ERROR', 'Bot died!');
  }
}

module.exports = { DecisionEngine };
