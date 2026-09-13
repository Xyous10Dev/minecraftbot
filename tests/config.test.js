const assert = require('assert');
const { Config, getConfig } = require('../src/core/config');
const test = require('node:test');

test('Config', async (t) => {
  t.beforeEach(() => {
    // Reset environment for each test
    process.env.MC_HOST = 'localhost';
    process.env.MC_PORT = '25565';
    process.env.MC_VERSION = '1.20.1';
    process.env.BOT_USERNAME = 'TestBot';
    process.env.TARGET_PLAYER = 'testplayer';
    process.env.PREPARATION_SECONDS = '60';
    process.env.TARGET_RESPAWN_WINDOW_SECONDS = '300';
    process.env.DASHBOARD_HOST = '127.0.0.1';
    process.env.DASHBOARD_PORT = '50000';
    process.env.MODE = 'development';
    process.env.LOG_LEVEL = 'INFO';
  });

  await t.test('should load configuration from environment variables', () => {
    const config = new Config();
    assert.strictEqual(config.mcHost, 'localhost');
    assert.strictEqual(config.mcPort, 25565);
    assert.strictEqual(config.mcVersion, '1.20.1');
    assert.strictEqual(config.botUsername, 'TestBot');
    assert.strictEqual(config.targetPlayer, 'testplayer');
    assert.strictEqual(config.preparationSeconds, 60);
    assert.strictEqual(config.targetRespawnWindowSeconds, 300);
    assert.strictEqual(config.dashboardPort, 50000);
  });

  await t.test('should use default values when environment variables are not set', () => {
    delete process.env.MC_HOST;
    delete process.env.TARGET_PLAYER;
    const config = new Config();
    assert.strictEqual(config.mcHost, 'localhost');
    assert.strictEqual(config.targetPlayer, 'mr_xyous');
  });

  await t.test('should validate mode', () => {
    process.env.MODE = 'invalid';
    assert.throws(() => new Config(), /Invalid mode/);
  });

  await t.test('should return correct server options', () => {
    const config = new Config();
    const options = config.getServerOptions();
    assert.strictEqual(options.host, 'localhost');
    assert.strictEqual(options.port, 25565);
    assert.strictEqual(options.username, 'TestBot');
    assert.strictEqual(options.version, '1.20.1');
  });

  await t.test('should identify development mode correctly', () => {
    process.env.MODE = 'development';
    const config = new Config();
    assert.strictEqual(config.isDevelopment(), true);
    assert.strictEqual(config.isSurvival(), false);
    assert.strictEqual(config.isBenchmark(), false);
  });
});
