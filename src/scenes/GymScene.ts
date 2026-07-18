import Phaser from 'phaser';
import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { InputManager } from '@/systems/input';
import { KeyboardInputSource } from '@/systems/inputSources/KeyboardInputSource';
import { GamepadInputSource } from '@/systems/inputSources/GamepadInputSource';
import { TouchInputSource } from '@/systems/inputSources/TouchInputSource';
import { Player } from '@/actors/Player';
import { TargetDummy } from '@/actors/TargetDummy';
import { MovingPlatform } from '@/actors/MovingPlatform';
import type { Projectile } from '@/actors/Projectile';
import { DebugOverlay } from '@/systems/debugOverlay';

const LEVEL_HEIGHT = 180;
const GROUND_TOP = 160;
const GROUND_THICKNESS = 30; // extends past the visible bottom; only the top surface matters
const SPAWN_X = 40;
const SPAWN_Y = 140;

interface Block {
  x: number;
  width: number;
}

/** Contiguous ground segments, i.e. the level minus its 1/2/3-tile gaps and the moving-platform gap. */
const GROUND_SEGMENTS: Block[] = [
  { x: 0, width: 150 }, // start
  { x: 166, width: 94 }, // after 1-tile gap
  { x: 292, width: 98 }, // after 2-tile gap
  { x: 438, width: 512 }, // after 3-tile gap: stairs, wall-kick shaft, spikes all sit on this run
  { x: 1050, width: 350 }, // after the moving-platform gap: dummy area + end
];

const STAIRS_ORIGIN_X = 460;
const STAIR_STEP = { width: 22, height: 16 };
const STAIR_COUNT = 4;
const STAIRS_TOP_Y = GROUND_TOP - STAIR_COUNT * STAIR_STEP.height;

// The wall-kick shaft is an optional detour reached from the stairs'
// top platform, not a gate across the main ground path: its walls stop
// at the stairs' height rather than reaching all the way to GROUND_TOP,
// so a player who ignores it can always walk the ground level, unobstructed.
const SHAFT_X = 610;
const SHAFT_GAP = 40;
const SHAFT_WALL_WIDTH = 12;
const SHAFT_TOP = 20;

const SPIKE_X = 820;
const SPIKE_COUNT = 3;
const SPIKE_SIZE = 12;

const MOVING_PLATFORM_GAP = { left: 950, right: 1050 };

const TARGET_DUMMY_X = 1180;

/**
 * Graybox test room for the Player controller (M1 spec): flat ground,
 * stairs, 1/2/3-tile gaps, a wall-kick shaft, spikes, a moving platform
 * over a gap too wide to jump, and a target dummy.
 */
export class GymScene extends BaseScene {
  private player!: Player;
  private inputManager!: InputManager;
  private touchSource!: TouchInputSource;
  private movingPlatform!: MovingPlatform;
  private targetDummy!: TargetDummy;
  private debugOverlay!: DebugOverlay;
  private hazards!: Phaser.Physics.Arcade.StaticGroup;
  private solids!: Phaser.Physics.Arcade.StaticGroup;

  constructor() {
    super('Gym');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    const levelWidth = MOVING_PLATFORM_GAP.right + 350;
    this.physics.world.setBounds(0, 0, levelWidth, LEVEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, levelWidth, LEVEL_HEIGHT);

    this.solids = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();

    this.buildGround();
    this.buildStairs();
    this.buildWallKickShaft();
    this.buildSpikes();

    this.player = new Player(this, SPAWN_X, SPAWN_Y);
    this.targetDummy = new TargetDummy(this, TARGET_DUMMY_X, GROUND_TOP - 12);
    this.movingPlatform = new MovingPlatform(
      this,
      (MOVING_PLATFORM_GAP.left + MOVING_PLATFORM_GAP.right) / 2,
      GROUND_TOP - 4,
      48,
      MOVING_PLATFORM_GAP.right - MOVING_PLATFORM_GAP.left - 48,
      30,
    );

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.movingPlatform);
    this.physics.add.overlap(this.player.hurtboxZone, this.hazards, () => this.onPlayerHitHazard());
    this.physics.add.overlap(
      [...this.player.buster.projectiles],
      this.targetDummy,
      (projectileObj) => this.onProjectileHitDummy(projectileObj as Projectile),
    );

    this.cameras.main.startFollow(this.player.visual, false, 0.15, 0.15);
    this.cameras.main.setDeadzone(40, 60);

    this.inputManager = new InputManager([
      new KeyboardInputSource(this),
      new GamepadInputSource(this),
      (this.touchSource = new TouchInputSource(this, {
        safeLeft: 0,
        safeRight: this.scale.width,
        worldHeight: this.scale.height,
      })),
    ]);

    this.debugOverlay = new DebugOverlay(this, this.player, [this.targetDummy]);

    this.add
      .text(4, 4, 'GYM', { fontFamily: 'monospace', fontSize: '10px', color: THEME.textCream })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  protected fixedUpdate(): void {
    const input = this.inputManager.sample();
    this.player.fixedUpdate(input);
    this.movingPlatform.fixedUpdate();
    this.carryRiderIfOnPlatform();

    if (this.player.hitPoints <= 0 || this.player.y > LEVEL_HEIGHT + 200) {
      this.player.respawnAt(SPAWN_X, SPAWN_Y);
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.player.updateRenderPosition(this.renderAlpha);
    this.movingPlatform.updateRenderPosition(this.renderAlpha);
    this.touchSource.refreshVisuals();
    this.debugOverlay.refresh();
  }

  private carryRiderIfOnPlatform(): void {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const platformBody = this.movingPlatform.body as Phaser.Physics.Arcade.Body;

    const standingOnPlatform =
      playerBody.blocked.down &&
      Math.abs(playerBody.bottom - platformBody.top) < 2 &&
      playerBody.right > platformBody.left &&
      playerBody.left < platformBody.right;

    if (!standingOnPlatform) return;

    const { dx } = this.movingPlatform.stepDelta;
    if (dx === 0) return;

    playerBody.x += dx;
    playerBody.updateCenter();
  }

  private onPlayerHitHazard(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.player.takeDamage(
      4,
      body.center.x < SPIKE_X + SPIKE_COUNT * SPIKE_SIZE ? SPIKE_X : body.center.x,
    );
  }

  private onProjectileHitDummy(projectile: Projectile): void {
    if (!projectile.active) return;
    this.targetDummy.takeDamage(projectile.damage);
    projectile.deactivate();
  }

  private buildGround(): void {
    for (const segment of GROUND_SEGMENTS) {
      this.addSolidBlock(
        segment.x + segment.width / 2,
        GROUND_TOP + GROUND_THICKNESS / 2,
        segment.width,
        GROUND_THICKNESS,
        THEME.panel,
      );
    }
  }

  private buildStairs(): void {
    for (let i = 0; i < STAIR_COUNT; i += 1) {
      const stepTop = GROUND_TOP - (i + 1) * STAIR_STEP.height;
      this.addSolidBlock(
        STAIRS_ORIGIN_X + i * STAIR_STEP.width + STAIR_STEP.width / 2,
        stepTop + STAIR_STEP.height / 2,
        STAIR_STEP.width,
        STAIR_STEP.height,
        THEME.panel,
      );
    }
  }

  private buildWallKickShaft(): void {
    // A short approach platform bridges the stairs' top step to the
    // shaft's base, at the same height, so its entrance is a normal
    // jump away rather than requiring a leap of faith.
    const shaftLeftWallX = SHAFT_X - SHAFT_GAP / 2 - SHAFT_WALL_WIDTH / 2;
    const stairsTopRightEdge = STAIRS_ORIGIN_X + STAIR_COUNT * STAIR_STEP.width;
    const approachWidth = shaftLeftWallX - stairsTopRightEdge;
    this.addSolidBlock(
      stairsTopRightEdge + approachWidth / 2,
      STAIRS_TOP_Y + STAIR_STEP.height / 2,
      approachWidth,
      STAIR_STEP.height,
      THEME.panel,
    );

    const shaftHeight = STAIRS_TOP_Y - SHAFT_TOP;
    this.addSolidBlock(
      shaftLeftWallX,
      SHAFT_TOP + shaftHeight / 2,
      SHAFT_WALL_WIDTH,
      shaftHeight,
      THEME.accentTeal,
    );
    this.addSolidBlock(
      SHAFT_X + SHAFT_GAP / 2 + SHAFT_WALL_WIDTH / 2,
      SHAFT_TOP + shaftHeight / 2,
      SHAFT_WALL_WIDTH,
      shaftHeight,
      THEME.accentTeal,
    );
    // Landing ledge at the top of the shaft, reachable by wall-kick chaining.
    this.addSolidBlock(SHAFT_X, SHAFT_TOP - 4, SHAFT_GAP + SHAFT_WALL_WIDTH * 2, 8, THEME.panel);
  }

  private buildSpikes(): void {
    for (let i = 0; i < SPIKE_COUNT; i += 1) {
      const x = SPIKE_X + i * SPIKE_SIZE;
      const texture = getRectTexture(this, 'spike', SPIKE_SIZE, SPIKE_SIZE, THEME.accentCoral);
      const spike = this.physics.add.staticImage(x, GROUND_TOP - SPIKE_SIZE / 2, texture);
      this.hazards.add(spike);
    }
  }

  private addSolidBlock(x: number, y: number, width: number, height: number, color: number): void {
    const texture = getRectTexture(this, `block-${width}x${height}-${color}`, width, height, color);
    const block = this.physics.add.staticImage(x, y, texture);
    this.solids.add(block);
  }
}
