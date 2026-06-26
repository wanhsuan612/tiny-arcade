import test from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, GameSession, PHASES } from '../src/core.js';

test('session enforces economy and phase transitions', () => {
  const bus = new EventBus();
  const session = new GameSession(bus);
  const reasons = [];

  bus.on('session:changed', ({ reason }) => reasons.push(reason));

  assert.equal(session.spendGold(4), true);
  assert.equal(session.state.gold, 8);
  assert.equal(session.spendGold(99), false);
  assert.equal(session.state.gold, 8);

  session.setSelectedTool('unit:blade');
  session.setPhase(PHASES.BATTLE);

  assert.equal(session.state.phase, PHASES.BATTLE);
  assert.equal(session.state.selectedTool, null);
  assert.ok(reasons.includes('gold-spent'));
  assert.ok(reasons.includes('phase'));
});

test('session clamps crystal HP and publishes independent snapshots', () => {
  const session = new GameSession(new EventBus());

  session.setCrystalHp(9999, 700);
  const snapshot = session.snapshot();
  snapshot.crystal.hp = 1;

  assert.equal(session.state.crystal.hp, 700);

  session.setCrystalHp(-50);
  assert.equal(session.state.crystal.hp, 0);
});
