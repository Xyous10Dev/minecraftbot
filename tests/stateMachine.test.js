const assert = require('assert');
const { BotState, Priority } = require('../src/core/stateMachine');
const test = require('node:test');

test('StateMachine', async (t) => {
  await t.test('should define all required states', () => {
    const expectedStates = [
      'INITIALIZING',
      'PREPARATION',
      'TRACKING',
      'GATHERING',
      'CRAFTING',
      'EQUIPPING',
      'INTERCEPTING',
      'CHASE',
      'COMBAT',
      'RETREAT',
      'RECOVERY',
      'LOOTING',
      'UPGRADING',
      'NETHER_PROGRESS',
      'ENDGAME_INTERCEPTION',
      'SEARCHING',
      'TARGET_DEAD',
      'FIVE_MINUTE_UPGRADE',
      'EMERGENCY'
    ];
    
    for (const state of expectedStates) {
      assert(BotState[state] === state, `State ${state} should be defined`);
    }
  });

  await t.test('should define priority levels', () => {
    assert.strictEqual(Priority.CRITICAL, 0);
    assert.strictEqual(Priority.HIGH, 1);
    assert.strictEqual(Priority.MEDIUM, 2);
    assert.strictEqual(Priority.LOW, 3);
  });
});
