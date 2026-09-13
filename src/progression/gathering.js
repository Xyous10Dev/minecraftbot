const { getLogger } = require('../core/logger');

/**
 * Resource gathering system for Minehunt AI
 * Handles automated collection of wood, stone, food, and other resources
 */
class Gatherer {
  constructor(bot) {
    this.bot = bot;
    this.logger = getLogger();
    
    this.isGathering = false;
    this.currentTarget = null;
    this.gatheredItems = [];
    this.gatheringStats = {
      blocksMined: 0,
      woodCollected: 0,
      stoneCollected: 0,
      foodCollected: 0,
      oresCollected: 0
    };
  }
  
  /**
   * Gather wood (priority: oak > birch > spruce > jungle)
   */
  async gatherWood(targetCount = 20) {
    if (this.isGathering) return false;
    
    this.logger.tagged('GATHER', 'INFO', `Starting wood gathering (target: ${targetCount})`);
    this.isGathering = true;
    
    const woodLogs = [
      'oak_log',
      'birch_log',
      'spruce_log',
      'jungle_log',
      'acacia_log',
      'dark_oak_log'
    ];
    
    let collected = 0;
    
    // Find nearby wood
    const foundLogs = this.findNearbyBlocks(woodLogs, 32);
    
    for (const logBlock of foundLogs) {
      if (collected >= targetCount) break;
      
      try {
        await this.mineBlock(logBlock);
        collected++;
        this.gatheringStats.woodCollected++;
        
        this.logger.tagged('GATHER', 'DEBUG', `Wood collected: ${collected}/${targetCount}`);
      } catch (error) {
        this.logger.tagged('GATHER', 'WARN', `Failed to mine log: ${error.message}`);
      }
    }
    
    this.isGathering = false;
    this.logger.tagged('GATHER', 'INFO', `Wood gathering complete: ${collected} collected`);
    
    return collected > 0;
  }
  
  /**
   * Gather stone for tools
   */
  async gatherStone(targetCount = 30) {
    if (this.isGathering) return false;
    
    this.logger.tagged('GATHER', 'INFO', `Starting stone gathering (target: ${targetCount})`);
    this.isGathering = true;
    
    let collected = 0;
    
    // Find nearby stone
    const stoneBlocks = this.findNearbyBlocks(['stone'], 24);
    
    for (const stoneBlock of stoneBlocks) {
      if (collected >= targetCount) break;
      
      // Don't dig straight down!
      if (this.isUnderneath(stoneBlock)) {
        continue;
      }
      
      try {
        await this.mineBlock(stoneBlock);
        collected++;
        this.gatheringStats.stoneCollected++;
      } catch (error) {
        this.logger.tagged('GATHER', 'WARN', `Failed to mine stone: ${error.message}`);
      }
    }
    
    this.isGathering = false;
    this.logger.tagged('GATHER', 'INFO', `Stone gathering complete: ${collected} collected`);
    
    return collected > 0;
  }
  
  /**
   * Find and collect food
   */
  async gatherFood(targetCount = 10) {
    if (this.isGathering) return false;
    
    this.logger.tagged('GATHER', 'INFO', 'Looking for food sources...');
    this.isGathering = true;
    
    const foodSources = [
      'wheat',
      'carrots',
      'potatoes',
      'beetroots',
      'apple', // from leaves
      'sweet_berries',
      'glow_berries'
    ];
    
    // Also hunt animals for food
    const animals = ['cow', 'pig', 'sheep', 'chicken'];
    
    let collected = 0;
    
    // Try plants first
    const plants = this.findNearbyBlocks(foodSources, 32);
    for (const plant of plants) {
      if (collected >= targetCount) break;
      
      try {
        await this.mineBlock(plant);
        collected++;
        this.gatheringStats.foodCollected++;
      } catch (error) {
        // Continue to next
      }
    }
    
    // If not enough, hunt animals
    if (collected < targetCount) {
      this.logger.tagged('GATHER', 'INFO', 'Hunting animals for food...');
      // Animal hunting would be implemented here
    }
    
    this.isGathering = false;
    this.logger.tagged('GATHER', 'INFO', `Food gathering complete: ${collected} collected`);
    
    return collected > 0;
  }
  
  /**
   * Mine coal ore for fuel and torches
   */
  async gatherCoal(targetCount = 16) {
    if (this.isGathering) return false;
    
    this.logger.tagged('GATHER', 'INFO', `Looking for coal (target: ${targetCount})`);
    this.isGathering = true;
    
    let collected = 0;
    const coalOre = this.findNearbyBlocks(['coal_ore', 'deepslate_coal_ore'], 32);
    
    for (const ore of coalOre) {
      if (collected >= targetCount) break;
      
      if (this.isUnderneath(ore)) continue;
      
      try {
        await this.mineBlock(ore);
        collected++;
        this.gatheringStats.oresCollected++;
      } catch (error) {
        // Continue
      }
    }
    
    this.isGathering = false;
    return collected > 0;
  }
  
  /**
   * Find nearby blocks of specified types
   */
  findNearbyBlocks(blockTypes, radius) {
    const found = [];
    const pos = this.bot.entity.position;
    
    for (let x = -radius; x <= radius; x++) {
      for (let y = -8; y <= 8; y++) {
        for (let z = -radius; z <= radius; z++) {
          const checkPos = pos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos);
          
          if (block && blockTypes.includes(block.name)) {
            found.push(block);
          }
        }
      }
    }
    
    // Sort by distance
    return found.sort((a, b) => {
      return pos.distanceTo(a.position) - pos.distanceTo(b.position);
    });
  }
  
  /**
   * Check if a block is underneath the bot (dangerous to mine)
   */
  isUnderneath(block) {
    const botY = Math.floor(this.bot.entity.position.y);
    const blockY = Math.floor(block.position.y);
    return blockY < botY;
  }
  
  /**
   * Mine a specific block
   */
  async mineBlock(block) {
    // Move to mining position
    const miningPos = block.position.offset(0, 1, 0);
    
    // Navigate to block (simplified - would use pathfinder)
    this.bot.lookAt(block.position);
    
    // Equip proper tool
    await this.equipBestTool(block);
    
    // Mine the block
    await this.bot.dig(block);
    
    this.gatheringStats.blocksMined++;
    
    return true;
  }
  
  /**
   * Equip the best tool for the block type
   */
  async equipBestTool(block) {
    const toolPriority = {
      'stone': ['pickaxe'],
      'coal_ore': ['pickaxe'],
      'iron_ore': ['pickaxe'],
      'diamond_ore': ['pickaxe'],
      'oak_log': ['axe'],
      'birch_log': ['axe'],
      'spruce_log': ['axe'],
      'dirt': ['shovel'],
      'sand': ['shovel']
    };
    
    const neededTools = toolPriority[block.name] || [];
    
    for (const toolType of neededTools) {
      const pickaxes = ['diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
      const axes = ['diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'];
      const shovels = ['diamond_shovel', 'iron_shovel', 'stone_shovel', 'wooden_shovel'];
      
      let tools = [];
      if (toolType === 'pickaxe') tools = pickaxes;
      else if (toolType === 'axe') tools = axes;
      else if (toolType === 'shovel') tools = shovels;
      
      for (const tool of tools) {
        const slot = this.findItemByName(tool);
        if (slot) {
          await this.bot.equip(slot, 'hand');
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Find item in inventory
   */
  findItemByName(name) {
    const items = this.bot.inventory.items();
    return items.find(item => item.name === name);
  }
  
  /**
   * Get gathering statistics
   */
  getStatus() {
    return {
      isGathering: this.isGathering,
      stats: this.gatheringStats,
      recentItems: this.gatheredItems.slice(-10)
    };
  }
}

module.exports = { Gatherer };
