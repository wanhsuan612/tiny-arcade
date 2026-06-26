import { getAppContext, PHASES } from './core.js';
import { AssetRuntime, ActorFactory } from './runtime.js';
import { CombatSystem, PlacementSystem, WaveDirector } from './systems.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    const context = getAppContext();
    context.assetRuntime = new AssetRuntime(this, context.content, context.bus);
    context.assetRuntime.preload();

    this.load.on('progress', (progress) => {
      context.bus.emit('boot:progress', { progress });
    });
  }

  create() {
    const context = getAppContext();
    context.assetRuntime.finalize();
    context.bus.emit('boot:ready');
    this.scene.start('battle');
  }
}

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
    this.unsubscribers = [];
    this.lastCountRefreshAt = 0;
  }

  create() {
    const context = getAppContext();
    this.context = context;
    this.session = context.session;
    this.bus = context.bus;
    this.content = context.content;
    this.assetRuntime = context.assetRuntime;

    this.physics.world.setBounds(0, 0, 960, 640);
    this.cameras.main.setBounds(0, 0, 960, 640);
    this.cameras.main.roundPixels = true;

    this.actorFactory = new ActorFactory(this, this.content, this.assetRuntime);
    this.combat = new CombatSystem(this, context);
    this.placement = new PlacementSystem(this, {
      ...context,
      actorFactory: this.actorFactory,
      combat: this.combat
    });
    this.waveDirector = new WaveDirector(this, {
      ...context,
      actorFactory: this.actorFactory,
      combat: this.combat
    });

    this.placement.createGrid();
    this.createDecorations();
    this.createCoreAndInitialDeployment();
    this.configureInput();
    this.configureCommands();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());

    this.session.setPhase(PHASES.PLANNING);
    this.session.notify('v0.2 骨架已就緒：已有一名免費劍士，可部署建築後開始波次。', 'good');
    this.publishCounts();
  }

  createDecorations() {
    const graphics = this.add.graphics().setDepth(-900);

    graphics.lineStyle(2, 0x79e7d5, 0.12);
    graphics.strokeCircle(480, 320, 116);
    graphics.strokeCircle(480, 320, 176);

    graphics.lineStyle(2, 0xd6fff1, 0.08);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      graphics.lineBetween(
        480 + Math.cos(angle) * 106,
        320 + Math.sin(angle) * 106,
        480 + Math.cos(angle) * 294,
        320 + Math.sin(angle) * 294
      );
    }
  }

  createCoreAndInitialDeployment() {
    this.crystal = this.actorFactory.createCrystal(480, 320, 700);
    this.combat.registerActor(this.crystal);
    this.session.setCrystalHp(this.crystal.hp, this.crystal.maxHp);

    this.placement.placeInitial('unit:blade', 5, 7);
  }

  configureInput() {
    const canvas = this.game.canvas;
    canvas.addEventListener('contextmenu', this.preventContextMenu = (event) => event.preventDefault());

    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  configureCommands() {
    this.unsubscribers.push(
      this.bus.on('command:select-tool', ({ toolId }) => {
        this.session.setSelectedTool(toolId);
      }),
      this.bus.on('command:cancel-tool', () => {
        this.session.setSelectedTool(null);
      }),
      this.bus.on('command:start-wave', () => {
        this.startWave();
      }),
      this.bus.on('command:reset', () => {
        this.restartGame();
      }),
      this.bus.on('actor:died', ({ actor }) => {
        this.placement.handleActorDeath(actor);
        if (actor.actorKind === 'core') this.waveDirector.stop();
      }),
      this.bus.on('wave:cleared', () => {
        this.placement.restoreSurvivors();

        if (this.crystal.alive) {
          const heal = Math.round(this.crystal.maxHp * 0.04);
          this.crystal.setHealth(Math.min(this.crystal.maxHp, this.crystal.hp + heal));
          this.session.setCrystalHp(this.crystal.hp, this.crystal.maxHp);
        }

        this.publishCounts();
      })
    );
  }

  handlePointerMove(pointer) {
    this.placement.updateHover(pointer.worldX, pointer.worldY);
  }

  handlePointerDown(pointer) {
    if (this.session.state.phase !== PHASES.PLANNING) return;

    if (pointer.button === 2) {
      this.placement.removeAt(pointer.worldX, pointer.worldY);
      return;
    }

    this.placement.placeSelectedTool(pointer.worldX, pointer.worldY);
  }

  startWave() {
    if (this.session.state.phase !== PHASES.PLANNING) return;

    const defenders = this.combat.countAlive('unit') + this.combat.countAlive('building');
    if (defenders === 0) {
      this.session.notify('至少需要一名角色或一座防禦建築。', 'bad');
      return;
    }

    this.session.setSelectedTool(null);
    this.session.setPhase(PHASES.BATTLE);
    this.waveDirector.start(this.session.state.round);
  }

  restartGame() {
    this.waveDirector.stop();
    this.session.reset();
    this.scene.restart();
  }

  update(time, delta) {
    if (!this.combat || this.session.state.phase === PHASES.DEFEAT) return;

    if (this.session.state.phase === PHASES.BATTLE) {
      this.combat.update(delta);
      this.waveDirector.update(delta);
    } else {
      for (const actor of this.combat.aliveActors()) {
        actor.tick(Math.min(0.05, delta / 1000));
        actor.stopMoving();
      }
    }

    if (time - this.lastCountRefreshAt >= 220) {
      this.publishCounts();
      this.lastCountRefreshAt = time;
    }
  }

  publishCounts() {
    this.session.setCounts({
      units: this.combat.countAlive('unit'),
      buildings: this.combat.countAlive('building'),
      enemies: this.combat.countAlive('monster')
    });
  }

  shutdownScene() {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();

    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.game.canvas.removeEventListener('contextmenu', this.preventContextMenu);

    this.waveDirector?.stop();
    this.placement?.destroy();
    this.combat?.destroy();
  }
}
