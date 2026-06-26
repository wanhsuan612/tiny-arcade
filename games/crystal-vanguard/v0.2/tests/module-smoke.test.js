import test from 'node:test';
import assert from 'node:assert/strict';

test('runtime, systems, scenes, and UI modules import with the Phaser surface they require', async () => {
  globalThis.Phaser = {
    Math: {
      DegToRad: (degrees) => degrees * Math.PI / 180,
      Angle: {
        Wrap: (angle) => angle
      }
    },
    Physics: {
      Arcade: {
        Sprite: class {}
      }
    },
    Scene: class {},
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown'
      }
    }
  };

  const runtime = await import('../src/runtime.js');
  const systems = await import('../src/systems.js');
  const scenes = await import('../src/scenes.js');
  const ui = await import('../src/ui.js');

  assert.equal(typeof runtime.AssetRuntime, 'function');
  assert.equal(typeof runtime.ActorFactory, 'function');
  assert.equal(typeof systems.CombatSystem, 'function');
  assert.equal(typeof scenes.BattleScene, 'function');
  assert.equal(typeof ui.HudController, 'function');
});
