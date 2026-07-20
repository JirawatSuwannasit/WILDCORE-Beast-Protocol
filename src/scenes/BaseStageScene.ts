import Phaser from 'phaser';
import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { getPlaceholderTilesetTexture } from '@/systems/placeholderTileset';
import { InputManager } from '@/systems/input';
import { KeyboardInputSource } from '@/systems/inputSources/KeyboardInputSource';
import { GamepadInputSource } from '@/systems/inputSources/GamepadInputSource';
import { TouchInputSource } from '@/systems/inputSources/TouchInputSource';
import { DebugOverlay, type DebugLandmark } from '@/systems/debugOverlay';
import { CheckpointManager } from '@/systems/checkpoint';
import { Player } from '@/actors/Player';
import { Enemy } from '@/actors/Enemy';
import { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { ElectricFence } from '@/actors/hazards/ElectricFence';
import { CollapsingBridgeTile } from '@/actors/hazards/CollapsingBridgeTile';
import {
  speedStripTuning,
  spikeTuning,
  enemyCommon,
  electricFenceTuning,
} from '@/config/enemyTuning';
import {
  getObjectLayer,
  getObjectProperty,
  objectCenter,
  type TiledMap,
  type TiledObject,
} from '@/data/tiledTypes';

const RESPAWN_SAFETY_Y_MARGIN = 200;
const LOOK_AHEAD_PX = 16;
const LOOK_AHEAD_LERP = 0.08;

// GDD §2.6: "never scroll the camera in a way that hides where the player
// will land" - a hard floor under the soft deadzone/lerp follow below. The
// deadzone (30x60, ~15px/30px half-extents) reacts to normal walking speed
// comfortably inside these margins, so this only ever engages during fast
// motion (falls, forced velocity, vertical-zone handoffs) the lerp-based
// follow can't keep up with in time - see DECISIONS.md.
const CAMERA_SAFETY_MARGIN_X = 32;
const CAMERA_SAFETY_MARGIN_Y = 24;

// A vertical camera zone's entry pans to the shaft's center over this long,
// instead of an instant scrollX snap - avoids a same-frame jump-cut that
// could otherwise land the player right at (or past) the safety margin
// before the very first corrected frame renders.
const VERTICAL_ZONE_ENTRY_PAN_MS = 220;
const NORMAL_CAMERA_LERP = 0.15;

// DEBUG TOOL ONLY (see debugOverlay.ts's path-line nav aid): entity
// `type`s that represent an off-route secret, drawn as a dim branch spur
// instead of a main-path node. Kept as a small known-set rather than a
// map-authored property, since it's purely a dev-build visualization
// concern - no stage generator needs to know about it.
const SECRET_ENTITY_TYPES = new Set([
  'bodyCapsulePump',
  'legsCapsule',
  'armsCapsule',
  'heartCapsule',
]);

export type EntitySpawner = (
  scene: BaseStageScene,
  x: number,
  y: number,
  object: TiledObject,
) => void;

/**
 * Shared plumbing for every tilemap-driven stage (GDD §11.2 - M4 will
 * build 7 more of these on top of the same base): Tiled JSON loading,
 * checkpoints, generic hazards (spikes/speed-strips/fences/collapsing
 * bridges), enemy stepping + reset-on-respawn, and camera look-ahead
 * with a boss-room lock. Stage-specific content (which enemies/bosses
 * exist, what the map file is) comes from the abstract members below.
 */
export abstract class BaseStageScene extends BaseScene {
  protected abstract readonly mapKey: string;
  protected abstract readonly mapData: TiledMap;
  protected abstract readonly tileColors: readonly number[];
  /** Maps a Tiled `entities` object's `type` to a spawn function; anything not listed is ignored. */
  protected abstract readonly entityRegistry: Record<string, EntitySpawner>;

  protected player!: Player;
  protected map!: Phaser.Tilemaps.Tilemap;
  protected groundLayer!: Phaser.Tilemaps.TilemapLayer;
  protected enemyBolts!: EnemyProjectilePool;
  protected checkpoints!: CheckpointManager;
  protected touchSource!: TouchInputSource;

  private inputManager!: InputManager;
  private debugOverlay!: DebugOverlay;
  private readonly enemies: Enemy[] = [];
  private readonly enemySpawns = new Map<Enemy, { x: number; y: number }>();
  private readonly bridges: CollapsingBridgeTile[] = [];
  private readonly fences: ElectricFence[] = [];
  private cameraLocked = false;
  private spawnPoint = { x: 16, y: 16 };

  private verticalCameraZone: Phaser.GameObjects.Zone | null = null;
  private inVerticalCameraZone = false;

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    this.cache.tilemap.add(this.mapKey, {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: this.mapData,
    });
    this.map = this.make.tilemap({ key: this.mapKey });

    const tilesetTextureKey = `${this.mapKey}-tiles`;
    getPlaceholderTilesetTexture(this, tilesetTextureKey, this.map.tileWidth, this.tileColors);
    const tilesetName = this.mapData.tilesets?.[0]?.name ?? 'placeholder';
    const tileset = this.map.addTilesetImage(
      tilesetName,
      tilesetTextureKey,
      this.map.tileWidth,
      this.map.tileHeight,
    );

    const groundLayer = tileset ? this.map.createLayer('ground', tileset, 0, 0) : null;
    if (!groundLayer)
      throw new Error(`BaseStageScene: failed to create ground layer for ${this.mapKey}`);
    this.groundLayer = groundLayer;
    // Phaser's Tiled-JSON parser represents an empty (GID 0) cell as tile
    // index -1 internally, not 0 - excluding [0] here would exclude
    // nothing real and mark every empty cell "solid" too, leaving no tile
    // anywhere with an "interesting" (boundary) face for Arcade to collide against.
    this.groundLayer.setCollisionByExclusion([-1]);

    const worldWidth = this.map.widthInPixels;
    const worldHeight = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.enemyBolts = new EnemyProjectilePool(this);

    const checkpointObjects = getObjectLayer(this.mapData, 'checkpoints');
    const startCheckpoint = checkpointObjects.find((o) => getObjectProperty(o, 'order', 0) === 0);
    const spawnObject = getObjectLayer(this.mapData, 'entities').find(
      (o) => o.type === 'playerSpawn',
    );
    this.spawnPoint = spawnObject
      ? objectCenter(spawnObject)
      : startCheckpoint
        ? objectCenter(startCheckpoint)
        : this.spawnPoint;
    this.checkpoints = new CheckpointManager(this.spawnPoint.x, this.spawnPoint.y);

    this.setupCheckpoints(checkpointObjects);
    this.setupHazards();

    this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y);
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.overlap(this.player.hurtboxZone, this.spikeGroup, () => this.onSpikeHit());

    this.setupEntities();

    // Ground-bound enemies (Spark Bug, Volt Cheetah) carry gravity and need
    // this exactly like the player does; flying/rooted enemies disable
    // their own gravity, so colliding them here is a harmless no-op.
    this.physics.add.collider(this.enemies, this.groundLayer);

    this.physics.add.overlap(this.player.hurtboxZone, this.enemies, (_hurtbox, enemyObj) => {
      this.onEnemyContact(enemyObj as unknown as Enemy);
    });
    this.physics.add.overlap(
      [...this.player.buster.projectiles],
      this.enemies,
      (projectileObj, enemyObj) => {
        const projectile = projectileObj as unknown as import('@/actors/Projectile').Projectile;
        const enemy = enemyObj as unknown as Enemy;
        if (!projectile.active || enemy.isDead) return;
        enemy.takeDamage(projectile.damage);
        projectile.deactivate();
      },
    );
    // GDD §5: any boss weapon vs. any enemy - bosses that implement a
    // weakness (see VoltCheetah.applyWeaponHit) get it for free here,
    // same as every future stage's boss will.
    this.physics.add.overlap(
      [...this.player.weapons.hitboxes],
      this.enemies,
      (hitboxObj, enemyObj) => {
        this.player.weapons.resolveEnemyHit(
          hitboxObj as unknown as import('@/actors/weapons/WeaponEffectSprite').WeaponEffectSprite,
          enemyObj as unknown as Enemy,
          this.enemies,
        );
      },
    );
    // Terra Spike (GDD §5: "ground wave that travels floor->walls") needs
    // real ground/wall collision to know when to turn and climb.
    this.physics.add.collider([...this.player.weapons.hitboxes], this.groundLayer, (hitboxObj) => {
      this.player.weapons.onGroundWaveWallContact(
        hitboxObj as unknown as import('@/actors/weapons/WeaponEffectSprite').WeaponEffectSprite,
      );
    });
    this.physics.add.overlap(
      this.player.hurtboxZone,
      [...this.enemyBolts.projectiles],
      (_hurtbox, boltObj) => {
        const bolt = boltObj as unknown as import('@/actors/EnemyProjectile').EnemyProjectile;
        if (!bolt.active) return;
        this.player.takeDamage(bolt.damage, bolt.x);
        bolt.deactivate();
      },
    );

    for (const bridge of this.bridges) {
      this.physics.add.collider(this.player, bridge, () => bridge.trigger());
    }

    this.cameras.main.startFollow(
      this.player.visual,
      false,
      NORMAL_CAMERA_LERP,
      NORMAL_CAMERA_LERP,
    );
    this.cameras.main.setDeadzone(30, 60);

    this.inputManager = new InputManager([
      new KeyboardInputSource(this),
      new GamepadInputSource(this),
      (this.touchSource = new TouchInputSource(this, {
        safeLeft: 0,
        safeRight: this.scale.width,
        worldHeight: this.scale.height,
      })),
    ]);

    const entityObjects = getObjectLayer(this.mapData, 'entities');
    const bossDoorObject = entityObjects.find((o) => o.type === 'bossDoor');
    const landmarks: DebugLandmark[] = [
      ...checkpointObjects.map((o) => ({ id: o.name, ...objectCenter(o), kind: 'main' as const })),
      ...getObjectLayer(this.mapData, 'sections').map((o) => ({
        id: o.name,
        ...objectCenter(o),
        kind: 'main' as const,
      })),
      ...(bossDoorObject
        ? [{ id: 'bossDoor', ...objectCenter(bossDoorObject), kind: 'main' as const }]
        : []),
      ...entityObjects
        .filter((o) => SECRET_ENTITY_TYPES.has(o.type))
        .map((o) => ({ id: o.name, ...objectCenter(o), kind: 'branch' as const })),
    ];
    this.debugOverlay = new DebugOverlay(this, this.player, [], landmarks);
  }

  // --- Setup helpers ---------------------------------------------------

  private setupCheckpoints(objects: TiledObject[]): void {
    for (const object of objects) {
      const order = getObjectProperty(object, 'order', 0);
      const { x, y } = objectCenter(object);
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      // A player must be spawned before this overlap can fire; deferred via scene event.
      this.events.once('create', () => {
        this.physics.add.overlap(this.player.hurtboxZone, zone, () => {
          this.checkpoints.tryActivate(order, x, y);
        });
      });
    }
  }

  private spikeGroup!: Phaser.Physics.Arcade.StaticGroup;

  private setupHazards(): void {
    this.spikeGroup = this.physics.add.staticGroup();
    const objects = getObjectLayer(this.mapData, 'hazards');

    for (const object of objects) {
      const { x, y } = objectCenter(object);
      switch (object.type) {
        case 'spikes': {
          const texture = getRectTexture(
            this,
            `spikes-${object.width}x${object.height}`,
            object.width,
            object.height,
            THEME.accentCoral,
          );
          this.spikeGroup.add(this.physics.add.staticImage(x, y, texture));
          break;
        }
        case 'speedStrip': {
          const strip = this.add.rectangle(
            x,
            y,
            object.width,
            object.height,
            THEME.accentTeal,
            0.5,
          );
          const zone = this.add.zone(x, y, object.width, object.height);
          this.physics.add.existing(zone, true);
          this.speedZoneList.push(zone);
          void strip;
          break;
        }
        case 'electricFence': {
          const fence = new ElectricFence(this, x, y, object.width, object.height);
          this.fences.push(fence);
          this.events.once('create', () => {
            this.physics.add.overlap(this.player.hurtboxZone, fence.hazardZone, () =>
              this.onFenceOverlap(fence),
            );
          });
          break;
        }
        case 'collapsingBridge': {
          const bridge = new CollapsingBridgeTile(this, x, y, object.width, object.height);
          this.bridges.push(bridge);
          break;
        }
        default:
          break;
      }
    }
  }

  private readonly speedZoneList: Phaser.GameObjects.Zone[] = [];

  private setupEntities(): void {
    for (const object of getObjectLayer(this.mapData, 'entities')) {
      const spawner = this.entityRegistry[object.type];
      if (!spawner) continue;
      const { x, y } = objectCenter(object);
      spawner(this, x, y, object);
    }
  }

  /** Called by stage-specific entity spawners (see entityRegistry) to register an enemy for stepping/reset/overlap. */
  registerEnemy(enemy: Enemy, spawnX: number, spawnY: number): void {
    this.enemies.push(enemy);
    this.enemySpawns.set(enemy, { x: spawnX, y: spawnY });
    // Frost Talon (GDD §3.4): the platform an enemy stands in for while
    // frozen - registered once per enemy, up front, since the body
    // starts disabled and only ever activates for the freeze's duration.
    this.physics.add.collider(this.player, enemy.platformBody);
  }

  // --- Per-frame ---------------------------------------------------------

  protected fixedUpdate(): void {
    const input = this.inputManager.sample();

    this.player.applySpeedMultiplier(this.isOnSpeedStrip() ? speedStripTuning.speedMultiplier : 1);
    this.player.fixedUpdate(input);

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.fixedUpdate(this.player.x, this.player.y, this.enemyBolts);
    }
    for (const fence of this.fences) fence.fixedUpdate();
    for (const bridge of this.bridges) bridge.fixedUpdate();

    this.updateCameraLookAhead();
    this.updateVerticalCameraZone();

    if (
      this.player.hitPoints <= 0 ||
      this.player.y > this.map.heightInPixels + RESPAWN_SAFETY_Y_MARGIN
    ) {
      this.respawnPlayer();
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.player.updateRenderPosition(this.renderAlpha);
    for (const enemy of this.enemies) {
      if (enemy.active) enemy.updateRenderPosition(this.renderAlpha);
    }
    this.touchSource.refreshVisuals();
    this.debugOverlay.refresh();
    // Runs last, after every camera-affecting update this frame (look-ahead
    // offset, vertical-zone pan/lock, subclass boss-room lock) but before
    // Phaser's own preRender/render pass consumes scrollX/scrollY - see
    // DECISIONS.md for why this ordering guarantees the correction lands
    // before anything is drawn, not one frame late.
    this.enforceCameraSafetyMargin();
  }

  private isOnSpeedStrip(): boolean {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    return this.speedZoneList.some((zone) => this.physics.overlap(playerBody.gameObject, zone));
  }

  private updateCameraLookAhead(): void {
    if (this.cameraLocked) return;
    const camera = this.cameras.main;
    const targetOffset = this.player.facingDirection * LOOK_AHEAD_PX;
    const current = camera.followOffset.x;
    camera.setFollowOffset(Phaser.Math.Linear(current, -targetOffset, LOOK_AHEAD_LERP), 0);
  }

  /**
   * Registers a Tiled zone as a "vertical camera zone" (GDD §2.6: "vertical
   * camera zones for shafts (X-style), lock per arena"). While the player
   * overlaps it, horizontal scroll locks to the zone's own center instead
   * of following the player sideways, so a wall-kick shaft's climb never
   * scrolls left/right out from under them. Call once per shaft zone from
   * a subclass's entityRegistry spawner.
   */
  protected registerVerticalCameraZone(zone: Phaser.GameObjects.Zone): void {
    this.verticalCameraZone = zone;
  }

  private updateVerticalCameraZone(): void {
    if (!this.verticalCameraZone || this.cameraLocked) return;
    const overlapping = this.physics.overlap(this.player.hurtboxZone, this.verticalCameraZone);
    const camera = this.cameras.main;

    if (overlapping && !this.inVerticalCameraZone) {
      this.inVerticalCameraZone = true;
      const zoneBody = this.verticalCameraZone.body as Phaser.Physics.Arcade.StaticBody;
      const targetScrollX = zoneBody.center.x - camera.width / 2;
      // A zero X-lerp is what actually does the locking (startFollow's own
      // per-frame scrollX += (target-scrollX)*lerpX holds scrollX exactly
      // still at lerpX=0) - the tween below only smooths the *entry*, so a
      // player who crosses the boundary off-center from the shaft's true
      // midpoint doesn't get an instant same-frame jump-cut.
      camera.setLerp(0, NORMAL_CAMERA_LERP);
      this.tweens.add({
        targets: camera,
        scrollX: targetScrollX,
        duration: VERTICAL_ZONE_ENTRY_PAN_MS,
        ease: 'Sine.easeOut',
      });
    } else if (!overlapping && this.inVerticalCameraZone) {
      this.inVerticalCameraZone = false;
      camera.setLerp(NORMAL_CAMERA_LERP, NORMAL_CAMERA_LERP);
    }
  }

  /** GDD §2.6 camera safety floor - see the module-level constants' doc comment. */
  private enforceCameraSafetyMargin(): void {
    if (this.cameraLocked) return;
    const camera = this.cameras.main;
    const target = this.player.visual;

    const maxScrollX = target.x - CAMERA_SAFETY_MARGIN_X;
    const minScrollX = target.x - (camera.width - CAMERA_SAFETY_MARGIN_X);
    if (camera.scrollX > maxScrollX) camera.scrollX = maxScrollX;
    else if (camera.scrollX < minScrollX) camera.scrollX = minScrollX;

    const maxScrollY = target.y - CAMERA_SAFETY_MARGIN_Y;
    const minScrollY = target.y - (camera.height - CAMERA_SAFETY_MARGIN_Y);
    if (camera.scrollY > maxScrollY) camera.scrollY = maxScrollY;
    else if (camera.scrollY < minScrollY) camera.scrollY = minScrollY;
  }

  // --- Hazard/enemy reactions ---------------------------------------------

  private onFenceOverlap(fence: ElectricFence): void {
    if (!fence.isActive) return;
    this.player.takeDamage(electricFenceTuning.damage, fence.hazardZone.x);
  }

  private onSpikeHit(): void {
    if (spikeTuning.lethal) {
      this.player.instaKill();
    } else {
      this.player.takeDamage(enemyCommon.contactDamage, this.player.x);
    }
  }

  private onEnemyContact(enemy: Enemy): void {
    if (enemy.isDead) return;
    this.player.takeDamage(enemyCommon.contactDamage, enemy.x);
  }

  protected respawnPlayer(): void {
    const { x, y } = this.checkpoints.respawnPoint;
    this.player.respawnAt(x, y);
    for (const enemy of this.enemies) {
      const spawn = this.enemySpawns.get(enemy);
      if (spawn) enemy.reset(spawn.x, spawn.y);
    }
  }

  /** Stops following the player and fixes the camera on a single boss-room screen (GDD §4). */
  protected lockCameraOn(centerX: number, centerY: number): void {
    this.cameraLocked = true;
    this.cameras.main.stopFollow();
    this.cameras.main.setFollowOffset(0, 0);
    this.cameras.main.pan(centerX, centerY, 350, 'Sine.easeInOut');
  }
}
