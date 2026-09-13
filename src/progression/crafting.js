const { getLogger } = require('../core/logger');

/**
 * Crafting system for Minehunt AI
 * Handles automated crafting of tools, weapons, and utility items
 */
class Crafter {
  constructor(bot) {
    this.bot = bot;
    this.logger = getLogger();
    
    this.craftingTable = null;
    this.hasCraftingTable = false;
    this.craftedItems = [];
    this.craftingStats = {
      totalCrafts: 0,
      toolsCrafted: 0,
      weaponsCrafted: 0,
      blocksCrafted: 0
    };
  }
  
  /**
   * Get or place a crafting table
   */
  async getCraftingTable() {
    // Check if we have one in inventory
    const craftingTable = this.findItemByName('crafting_table');
    
    if (craftingTable) {
      this.hasCraftingTable = true;
      return true;
    }
    
    // Need to craft one
    this.logger.tagged('CRAFT', 'INFO', 'No crafting table found. Crafting one...');
    return this.craftCraftingTable();
  }
  
  /**
   * Craft a crafting table
   */
  async craftCraftingTable() {
    // Need 4 planks of any type
    const plankTypes = [
      'oak_planks',
      'birch_planks',
      'spruce_planks',
      'jungle_planks',
      'acacia_planks',
      'dark_oak_planks'
    ];
    
    let planksCount = 0;
    for (const plankType of plankTypes) {
      const planks = this.findItemByName(plankType);
      if (planks && planks.count >= 4) {
        planksCount = planks.count;
        break;
      }
    }
    
    if (planksCount < 4) {
      this.logger.tagged('CRAFT', 'WARN', 'Not enough planks for crafting table');
      return false;
    }
    
    try {
      // Craft crafting table (2x2 recipe - can be done in inventory)
      await this.bot.craft(require('minecraft-data')(this.bot.version).recipesByInShape[1][0], null, 1);
      
      this.hasCraftingTable = true;
      this.craftingStats.blocksCrafted++;
      this.logger.tagged('CRAFT', 'INFO', 'Crafting table crafted!');
      
      return true;
    } catch (error) {
      this.logger.tagged('CRAFT', 'ERROR', 'Failed to craft crafting table:', error.message);
      return false;
    }
  }
  
  /**
   * Craft wooden pickaxe
   */
  async craftWoodenPickaxe() {
    return this.craftTool('wooden_pickaxe', 'stick', 'oak_planks');
  }
  
  /**
   * Craft stone pickaxe
   */
  async craftStonePickaxe() {
    return this.craftTool('stone_pickaxe', 'stick', 'cobblestone');
  }
  
  /**
   * Craft iron pickaxe
   */
  async craftIronPickaxe() {
    return this.craftTool('iron_pickaxe', 'stick', 'iron_ingot');
  }
  
  /**
   * Craft wooden sword
   */
  async craftWoodenSword() {
    return this.craftWeapon('wooden_sword', 'stick', 'oak_planks');
  }
  
  /**
   * Craft stone sword
   */
  async craftStoneSword() {
    return this.craftWeapon('stone_sword', 'stick', 'cobblestone');
  }
  
  /**
   * Craft iron sword
   */
  async craftIronSword() {
    return this.craftWeapon('iron_sword', 'stick', 'iron_ingot');
  }
  
  /**
   * Generic tool crafting
   */
  async craftTool(toolName, stickMaterial, mainMaterial) {
    await this.getCraftingTable();
    
    // Check materials
    const sticks = this.findItemByName('stick');
    const material = this.findItemByName(mainMaterial);
    
    if (!sticks || sticks.count < 2) {
      this.logger.tagged('CRAFT', 'WARN', `Not enough sticks for ${toolName}`);
      return false;
    }
    
    if (!material || material.count < 3) {
      this.logger.tagged('CRAFT', 'WARN', `Not enough ${mainMaterial} for ${toolName}`);
      return false;
    }
    
    try {
      const recipe = this.getRecipeFor(toolName);
      if (!recipe) {
        this.logger.tagged('CRAFT', 'ERROR', `No recipe found for ${toolName}`);
        return false;
      }
      
      await this.bot.craft(recipe, null, 1);
      
      this.craftingStats.toolsCrafted++;
      this.craftedItems.push(toolName);
      this.logger.tagged('CRAFT', 'INFO', `Crafted ${toolName}`);
      
      return true;
    } catch (error) {
      this.logger.tagged('CRAFT', 'ERROR', `Failed to craft ${toolName}:`, error.message);
      return false;
    }
  }
  
  /**
   * Generic weapon crafting
   */
  async craftWeapon(weaponName, stickMaterial, mainMaterial) {
    await this.getCraftingTable();
    
    const sticks = this.findItemByName('stick');
    const material = this.findItemByName(mainMaterial);
    
    if (!sticks || sticks.count < 1) {
      this.logger.tagged('CRAFT', 'WARN', `Not enough sticks for ${weaponName}`);
      return false;
    }
    
    if (!material || material.count < 2) {
      this.logger.tagged('CRAFT', 'WARN', `Not enough ${mainMaterial} for ${weaponName}`);
      return false;
    }
    
    try {
      const recipe = this.getRecipeFor(weaponName);
      if (!recipe) {
        this.logger.tagged('CRAFT', 'ERROR', `No recipe found for ${weaponName}`);
        return false;
      }
      
      await this.bot.craft(recipe, null, 1);
      
      this.craftingStats.weaponsCrafted++;
      this.craftedItems.push(weaponName);
      this.logger.tagged('CRAFT', 'INFO', `Crafted ${weaponName}`);
      
      return true;
    } catch (error) {
      this.logger.tagged('CRAFT', 'ERROR', `Failed to craft ${weaponName}:`, error.message);
      return false;
    }
  }
  
  /**
   * Craft sticks from planks
   */
  async craftSticks() {
    const plankTypes = [
      'oak_planks',
      'birch_planks',
      'spruce_planks',
      'jungle_planks',
      'acacia_planks',
      'dark_oak_planks'
    ];
    
    for (const plankType of plankTypes) {
      const planks = this.findItemByName(plankType);
      if (planks && planks.count >= 2) {
        try {
          const recipe = this.getRecipeFor('stick');
          if (recipe) {
            await this.bot.craft(recipe, null, 1);
            this.logger.tagged('CRAFT', 'DEBUG', 'Crafted sticks');
            return true;
          }
        } catch (error) {
          // Try next plank type
        }
      }
    }
    
    this.logger.tagged('CRAFT', 'WARN', 'Could not craft sticks');
    return false;
  }
  
  /**
   * Get recipe by item name (simplified - would need full recipe database)
   */
  getRecipeFor(itemName) {
    const mcData = require('minecraft-data')(this.bot.version);
    
    // Find recipe by output
    const recipes = mcData.recipes;
    for (const recipe of recipes) {
      if (recipe.result && recipe.result.name === itemName) {
        return recipe;
      }
    }
    
    return null;
  }
  
  /**
   * Find item in inventory
   */
  findItemByName(name) {
    const items = this.bot.inventory.items();
    return items.find(item => item && item.name === name);
  }
  
  /**
   * Check if we have essential tools
   */
  hasEssentialTools() {
    const tools = ['pickaxe', 'axe', 'sword'];
    const has = {};
    
    for (const tool of tools) {
      has[tool] = false;
      const items = this.bot.inventory.items();
      for (const item of items) {
        if (item.name && item.name.includes(tool)) {
          has[tool] = true;
          break;
        }
      }
    }
    
    return has;
  }
  
  /**
   * Get crafting status
   */
  getStatus() {
    return {
      hasCraftingTable: this.hasCraftingTable,
      craftedItems: this.craftedItems.slice(-10),
      stats: this.craftingStats,
      essentialTools: this.hasEssentialTools()
    };
  }
}

module.exports = { Crafter };
