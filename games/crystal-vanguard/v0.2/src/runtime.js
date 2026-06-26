import { DIRECTION_ROWS } from './content.js';

const DIRECTIONS = [
  { key: 'E', angle: 0 },
  { key: 'SE', angle: Math.PI / 4 },
  { key: 'S', angle: Math.PI / 2 },
  { key: 'SW', angle: Math.PI * 3 / 4 },
  { key: 'W', angle: Math.PI },
  { key: 'NW', angle: -Math.PI * 3 / 4 },
  { key: 'N', angle: -Math.PI / 2 },
  { key: 'NE', angle: -Math.PI / 4 }
];

const DIRECTION_BY_KEY = Object.fromEntries(DIRECTIONS.map((direction) => [direction.key, direction]));
const DIRECTION_HYSTERESIS = Phaser.Math.DegToRad(5);

function sanitizeTextureKey(id) {
  return `cv02-${id.replace(/[^a-z0-9]+/gi, '-')}`;
}

export function directionFromVector(dx, dy, currentDirection = 'S') {
  if (Math.hypot(dx, dy) < 0.01) return currentDirection;

  const angle = Math.atan2(dy, dx);
  const currentAngle = DIRECTION_BY_KEY[currentDirection]?.angle ?? Math.PI / 2;
  const distanceFromCurrent = Math.abs(Phaser.Math.Angle.Wrap(angle - currentAngle));

  if (distanceFromCurrent <= Math.PI / 8 + DIRECTION_HYSTERESIS) return currentDirection;
  const index = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  return DIRECTIONS[index].key;
}

export class AssetRuntime {
  constructor(scene, content, bus) {
    this.scene = scene;
    this.content = content;
    this.bus = bus;
    this.failedTextureKeys = new Set();
    this.placeholderKeys = new Map();
  }

  preload() {
    this.scene.load.on('loaderror', (file) => {
      this.failedTextureKeys.add(file.key);
      this.bus.emit('asset:warning', {
        assetKey: file.key,
        message: `素材載入失敗：${file.key}，已切換臨時圖形。`
      });
    });

    for (const asset of this.content.all('asset')) {
      if (asset.kind !== 'directional-sprite') continue;

      for (const action of Object.values(asset.actions)) {
        this.scene.load.spritesheet(action.texture, action.url, {
          frameWidth: asset.size.width,
          frameHeight: asset.size.height
        });
      }
    }
  }

  finalize() {
    this.createPlaceholderTextures();
    this.registerDirectionalAnimations();
  }

  getAsset(assetId) {
    return this.content.get('asset', assetId);
  }

  placeholderTextureKey(assetId) {
    return this.placeholderKeys.get(assetId) ?? `${sanitizeTextureKey(assetId)}-placeholder`;
  }

  initialTextureKey(assetId) {
    const asset = this.getAsset(assetId);
    if (asset.kind === 'directional-sprite') {
      const idleTexture = asset.actions.idle?.texture;
      if (idleTexture && this.scene.textures.exists(idleTexture) && !this.failedTextureKeys.has(idleTexture)) {
        return idleTexture;
      }
    }
    return this.placeholderTextureKey(assetId);
  }

  actionDuration(assetId, actionId) {
    const asset = this.getAsset(assetId);
    const action = asset.actions?.[actionId];
    if (!action) return 0.28;
    return action.frames / action.fps;
  }

  animationKey(assetId, actionId, direction) {
    return `cv02:${assetId}:${actionId}:${direction}`;
  }

  play(actor, assetId, actionId, direction = 'S') {
    const asset = this.getAsset(assetId);
    const normalizedDirection = DIRECTION_ROWS.includes(direction) ? direction : 'S';
    const action = asset.actions?.[actionId] ?? asset.actions?.idle;

    if (asset.kind === 'directional-sprite' && action) {
      const key = this.animationKey(assetId, actionId in asset.actions ? actionId : 'idle', normalizedDirection);
      if (this.scene.anims.exists(key)) {
        if (actor.anims.currentAnim?.key !== key || !actor.anims.isPlaying) {
          actor.play(key, true);
        }
        return;
      }
    }

    actor.anims.stop();
    actor.setTexture(this.placeholderTextureKey(assetId));
  }

  configurePhysicsSprite(actor, assetId) {
    const asset = this.getAsset(assetId);
    actor.setOrigin(asset.anchor.x / asset.size.width, asset.anchor.y / asset.size.height);
    actor.body.setSize(asset.body.width, asset.body.height, false);
    actor.body.setOffset(asset.body.offsetX, asset.body.offsetY);
  }

  spawnImpact(scene, x, y, tone = 'hit') {
    const palette = {
      hit: 0xffd47e,
      skill: 0x9de8d7,
      heal: 0xa8f1a0,
      bad: 0xff7d78
    };

    const ring = scene.add.circle(x, y - 8, 8, palette[tone] ?? palette.hit, 0.4);
    ring.setStrokeStyle(2, palette[tone] ?? palette.hit, 0.95);
    ring.setDepth(10000);
    scene.tweens.add({
      targets: ring,
      radius: 24,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  createPlaceholderTextures() {
    for (const asset of this.content.all('asset')) {
      const key = `${sanitizeTextureKey(asset.id)}-placeholder`;
      this.placeholderKeys.set(asset.id, key);
      if (this.scene.textures.exists(key)) continue;

      const graphics = this.scene.make.graphics({ add: false });
      const spec = asset.placeholder ?? asset.fallback ?? {
        shape: 'fighter',
        fill: 0xcbd5d1,
        accent: 0x71817d
      };

      this.drawPlaceholder(graphics, asset, spec);
      graphics.generateTexture(key, asset.size.width, asset.size.height);
      graphics.destroy();
    }
  }

  drawPlaceholder(graphics, asset, spec) {
    const width = asset.size.width;
    const height = asset.size.height;
    const fill = spec.fill;
    const accent = spec.accent;

    graphics.clear();

    switch (spec.shape) {
      case 'slime':
        graphics.fillStyle(fill, 1);
        graphics.fillEllipse(width / 2, height * 0.66, width * 0.72, height * 0.46);
        graphics.fillTriangle(width * 0.28, height * 0.58, width * 0.36, height * 0.22, width * 0.45, height * 0.58);
        graphics.fillStyle(accent, 1);
        graphics.fillCircle(width * 0.42, height * 0.61, 3);
        graphics.fillCircle(width * 0.58, height * 0.61, 3);
        break;

      case 'moth':
        graphics.fillStyle(fill, 1);
        graphics.fillTriangle(width * 0.48, height * 0.54, width * 0.08, height * 0.28, width * 0.2, height * 0.78);
        graphics.fillTriangle(width * 0.52, height * 0.54, width * 0.92, height * 0.28, width * 0.8, height * 0.78);
        graphics.fillStyle(accent, 1);
        graphics.fillEllipse(width / 2, height * 0.56, width * 0.18, height * 0.55);
        graphics.fillCircle(width / 2, height * 0.27, 5);
        break;

      case 'golem':
        graphics.fillStyle(fill, 1);
        graphics.fillRect(width * 0.24, height * 0.34, width * 0.52, height * 0.46);
        graphics.fillRect(width * 0.33, height * 0.13, width * 0.34, height * 0.26);
        graphics.fillRect(width * 0.12, height * 0.42, width * 0.2, height * 0.3);
        graphics.fillRect(width * 0.68, height * 0.42, width * 0.2, height * 0.3);
        graphics.fillStyle(accent, 1);
        graphics.fillRect(width * 0.42, height * 0.24, 4, 4);
        graphics.fillRect(width * 0.56, height * 0.24, 4, 4);
        break;

      case 'barricade':
        graphics.fillStyle(fill, 1);
        graphics.fillRect(width * 0.12, height * 0.34, width * 0.76, height * 0.16);
        graphics.fillRect(width * 0.12, height * 0.59, width * 0.76, height * 0.16);
        graphics.fillStyle(accent, 1);
        graphics.fillRect(width * 0.22, height * 0.2, width * 0.12, height * 0.68);
        graphics.fillRect(width * 0.66, height * 0.2, width * 0.12, height * 0.68);
        break;

      case 'tower':
        graphics.fillStyle(fill, 1);
        graphics.fillRect(width * 0.24, height * 0.42, width * 0.52, height * 0.43);
        graphics.fillStyle(accent, 1);
        graphics.fillRect(width * 0.14, height * 0.29, width * 0.72, height * 0.18);
        graphics.fillRect(width * 0.46, height * 0.09, width * 0.08, height * 0.28);
        graphics.fillTriangle(width * 0.5, height * 0.06, width * 0.38, height * 0.22, width * 0.62, height * 0.22);
        break;

      case 'crystal':
        graphics.fillStyle(fill, 1);
        graphics.fillPoints([
          new Phaser.Geom.Point(width * 0.5, height * 0.04),
          new Phaser.Geom.Point(width * 0.84, height * 0.3),
          new Phaser.Geom.Point(width * 0.72, height * 0.78),
          new Phaser.Geom.Point(width * 0.5, height * 0.94),
          new Phaser.Geom.Point(width * 0.28, height * 0.78),
          new Phaser.Geom.Point(width * 0.16, height * 0.3)
        ], true);
        graphics.fillStyle(accent, 0.72);
        graphics.fillTriangle(width * 0.5, height * 0.08, width * 0.5, height * 0.78, width * 0.72, height * 0.35);
        graphics.fillStyle(0x756b98, 1);
        graphics.fillRect(width * 0.2, height * 0.84, width * 0.6, height * 0.1);
        break;

      case 'bolt':
        graphics.fillStyle(fill, 1);
        graphics.fillRect(1, height * 0.38, width * 0.72, Math.max(2, height * 0.25));
        graphics.fillStyle(accent, 1);
        graphics.fillTriangle(width * 0.7, 0, width, height / 2, width * 0.7, height);
        break;

      case 'fighter':
      default:
        graphics.fillStyle(fill, 1);
        graphics.fillCircle(width * 0.5, height * 0.31, width * 0.13);
        graphics.fillRect(width * 0.35, height * 0.42, width * 0.3, height * 0.35);
        graphics.fillStyle(accent, 1);
        graphics.fillTriangle(width * 0.62, height * 0.45, width * 0.9, height * 0.22, width * 0.7, height * 0.65);
        graphics.fillRect(width * 0.38, height * 0.74, width * 0.08, height * 0.17);
        graphics.fillRect(width * 0.54, height * 0.74, width * 0.08, height * 0.17);
        break;
    }
  }

  registerDirectionalAnimations() {
    for (const asset of this.content.all('asset')) {
      if (asset.kind !== 'directional-sprite') continue;

      for (const [actionId, action] of Object.entries(asset.actions)) {
        if (!this.scene.textures.exists(action.texture) || this.failedTextureKeys.has(action.texture)) continue;

        for (let row = 0; row < DIRECTION_ROWS.length; row += 1) {
          const direction = DIRECTION_ROWS[row];
          const key = this.animationKey(asset.id, actionId, direction);
          if (this.scene.anims.exists(key)) continue;

          this.scene.anims.create({
            key,
            frames: this.scene.anims.generateFrameNumbers(action.texture, {
              start: row * action.frames,
              end: row * action.frames + action.frames - 1
            }),
            frameRate: action.fps,
            repeat: action.repeat,
            skipMissedFrames: true
          });
        }
      }
    }
  }
}

export class CombatActor extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, options) {
    const {
      definition,
      kind,
      team,
      assetRuntime,
      statScale = 1
    } = options;

    super(scene, x, y, assetRuntime.initialTextureKey(definition.visualAssetId));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.definition = definition;
    this.actorKind = kind;
    this.team = team;
    this.assetRuntime = assetRuntime;
    this.visualAssetId = definition.visualAssetId;
    this.displayName = definition.name;
    this.stats = {
      ...definition.stats,
      maxHp: Math.max(1, Math.round(definition.stats.maxHp * statScale)),
      moveSpeed: definition.stats.moveSpeed * Math.sqrt(statScale)
    };
    this.attack = {
      ...definition.attack,
      damage: Math.max(0, Math.round(definition.attack.damage * statScale))
    };
    this.skillIds = [...(definition.skillIds ?? [])];
    this.skillCounters = new Map();
    this.maxHp = this.stats.maxHp;
    this.hp = this.maxHp;
    this.alive = true;
    this.target = null;
    this.attackTimer = Phaser.Math.FloatBetween(0, Math.max(0.1, this.attack.cooldown || 0.1) * 0.35);
    this.retargetTimer = Phaser.Math.FloatBetween(0, 0.28);
    this.actionLock = 0;
    this.currentAction = 'idle';
    this.facing = 'S';
    this.homeCell = null;
    this.cost = definition.cost ?? 0;

    this.setCollideWorldBounds(false);
    assetRuntime.configurePhysicsSprite(this, this.visualAssetId);

    this.shadow = scene.add.ellipse(x, y + 2, Math.max(26, this.stats.radius * 2.1), Math.max(10, this.stats.radius * 0.72), 0x06100f, 0.38);
    this.shadow.setStrokeStyle(1, 0x8bb7a7, 0.1);

    this.healthBack = scene.add.rectangle(x, y - 50, Math.max(28, this.stats.radius * 2.2), 4, 0x071015, 0.78);
    this.healthFill = scene.add.rectangle(x, y - 50, Math.max(28, this.stats.radius * 2.2), 3, team === 'player' ? 0x79e7d5 : 0xff7d78, 1);
    this.healthFill.setOrigin(0, 0.5);

    this.playAction('idle', true);
    this.syncDecorations();
  }

  tick(deltaSeconds) {
    if (!this.alive) return;

    this.attackTimer = Math.max(0, this.attackTimer - deltaSeconds);
    this.retargetTimer = Math.max(0, this.retargetTimer - deltaSeconds);
    this.actionLock = Math.max(0, this.actionLock - deltaSeconds);

    if (this.actionLock === 0 && this.currentAction !== 'idle' && this.currentAction !== 'walk') {
      this.playAction(this.body.velocity.lengthSq() > 2 ? 'walk' : 'idle');
    }

    this.syncDecorations();
  }

  faceTowards(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const nextFacing = directionFromVector(dx, dy, this.facing);
    if (nextFacing === this.facing) return;
    this.facing = nextFacing;

    if (this.currentAction === 'idle' || this.currentAction === 'walk') {
      this.assetRuntime.play(this, this.visualAssetId, this.currentAction, this.facing);
    }
  }

  playAction(actionId, force = false) {
    if (!this.alive && actionId !== 'death') return;
    if (!force && this.currentAction === actionId && this.anims.isPlaying) return;
    this.currentAction = actionId;
    this.assetRuntime.play(this, this.visualAssetId, actionId, this.facing);
  }

  lockAction(actionId, duration) {
    this.actionLock = Math.max(this.actionLock, duration);
    this.playAction(actionId, true);
  }

  setLocomotion(moving) {
    if (!this.alive || this.actionLock > 0) return;
    this.playAction(moving ? 'walk' : 'idle');
  }

  stopMoving() {
    this.setVelocity(0, 0);
    this.setLocomotion(false);
  }

  flash(color = 0xffffff, duration = 80) {
    if (!this.active) return;
    this.setTintFill(color);
    this.scene.time.delayedCall(duration, () => {
      if (this.active) this.clearTint();
    });
  }

  setHealth(nextHp) {
    this.hp = Phaser.Math.Clamp(nextHp, 0, this.maxHp);
    this.syncDecorations();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.target = null;
    this.setVelocity(0, 0);
    this.body.enable = false;
    this.actionLock = Number.POSITIVE_INFINITY;
    this.playAction('death', true);
    this.shadow.setAlpha(0.16);
    this.healthBack.setVisible(false);
    this.healthFill.setVisible(false);
  }

  syncDecorations() {
    if (!this.active) return;

    this.setDepth(Math.floor(this.y));
    this.shadow
      .setPosition(this.x, this.y + 2)
      .setDepth(Math.floor(this.y) - 2);

    const barWidth = Math.max(28, this.stats.radius * 2.2);
    const barY = this.y - Math.max(34, this.displayHeight * 0.66);
    const healthRatio = this.maxHp > 0 ? this.hp / this.maxHp : 0;

    const showHealth = this.alive && healthRatio < 0.999;

    this.healthBack
      .setPosition(this.x, barY)
      .setDisplaySize(barWidth, 4)
      .setDepth(Math.floor(this.y) + 100)
      .setVisible(showHealth);

    this.healthFill
      .setPosition(this.x - barWidth / 2, barY)
      .setDisplaySize(Math.max(0.001, barWidth * healthRatio), 3)
      .setDepth(Math.floor(this.y) + 101)
      .setVisible(showHealth);
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    this.healthBack?.destroy();
    this.healthFill?.destroy();
    super.destroy(fromScene);
  }
}

export class ActorFactory {
  constructor(scene, content, assetRuntime) {
    this.scene = scene;
    this.content = content;
    this.assetRuntime = assetRuntime;
  }

  createProfession(professionId, x, y) {
    return new CombatActor(this.scene, x, y, {
      definition: this.content.get('profession', professionId),
      kind: 'unit',
      team: 'player',
      assetRuntime: this.assetRuntime
    });
  }

  createMonster(monsterId, x, y, statScale = 1) {
    return new CombatActor(this.scene, x, y, {
      definition: this.content.get('monster', monsterId),
      kind: 'monster',
      team: 'enemy',
      assetRuntime: this.assetRuntime,
      statScale
    });
  }

  createBuilding(buildingId, x, y) {
    return new CombatActor(this.scene, x, y, {
      definition: this.content.get('building', buildingId),
      kind: 'building',
      team: 'player',
      assetRuntime: this.assetRuntime
    });
  }

  createCrystal(x, y, maxHp = 700) {
    const definition = {
      id: 'crystal-core',
      name: '中央水晶',
      visualAssetId: 'core.crystal',
      cost: 0,
      skillIds: [],
      stats: {
        maxHp,
        moveSpeed: 0,
        armor: 0,
        aggroRange: 0,
        interceptRadius: 0,
        radius: 34
      },
      attack: {
        type: 'none',
        damage: 0,
        range: 0,
        cooldown: 0,
        impactDelay: 0
      }
    };

    return new CombatActor(this.scene, x, y, {
      definition,
      kind: 'core',
      team: 'player',
      assetRuntime: this.assetRuntime
    });
  }
}
