const { getConfig } = require('./config');

/**
 * Logger utility with levels and timestamps
 */
class Logger {
  constructor() {
    this.config = getConfig();
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    this.currentLevel = this.levels[this.config.logLevel] || this.levels.INFO;
  }

  /**
   * Format timestamp for logs
   */
  _getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
  }

  /**
   * Internal log method
   */
  _log(level, message, ...args) {
    if (this.levels[level] >= this.currentLevel) {
      const timestamp = this._getTimestamp();
      const prefix = `[${timestamp}] [${level}]`;
      console.log(prefix, message, ...args);
    }
  }

  debug(message, ...args) {
    this._log('DEBUG', message, ...args);
  }

  info(message, ...args) {
    this._log('INFO', message, ...args);
  }

  warn(message, ...args) {
    this._log('WARN', message, ...args);
  }

  error(message, ...args) {
    this._log('ERROR', message, ...args);
  }

  /**
   * Log with a specific category/tag
   */
  tagged(tag, level, message, ...args) {
    if (this.levels[level] >= this.currentLevel) {
      const timestamp = this._getTimestamp();
      const prefix = `[${timestamp}] [${tag}]`;
      console.log(prefix, message, ...args);
    }
  }
}

// Singleton instance
let loggerInstance = null;

function getLogger() {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

module.exports = { Logger, getLogger };
