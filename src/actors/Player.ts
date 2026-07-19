import Phaser from 'phaser';
import { playerTuning, TILE_SIZE } from '@/config/playerTuning';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { FrameWindow } from '@/systems/frameWindow';
import { EdgeDetector } from '@/systems/edgeDetector';
import { computeJumpVelocities, applyJumpCut } from '@/systems/jumpPhysics';
import { BusterWeapon } from '@/actors/BusterWeapon';
import { WeaponController } from '@/actors/WeaponController';
import { InterpolatedPhysicsSprite } from '@/actors/InterpolatedPhysicsSprite';
import type { InputSnapshot } from '@/systems/input';
import { debugFlags } from '@/systems/debugFlags';

export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'wallSlide' | 'dash' | 'hurt';

const { launchVelocity, cutVelocity } = computeJumpVelocities(
  playerTuning.gravity,
  playerTuning.jump.minHeightTiles * TILE_SIZE,
  playerTuning.jump.maxHeightTiles * TILE_SIZE,
);

/**
 * The player controller (GDD §2.2 / §2.5). Physics (position/collision)
 * is integrated by Phaser's own fixed-60Hz Arcade World step; this
 * class's `fixedUpdate` runs on the same cadence via BaseScene's
 * accumulator (see DECISIONS.md for why two parallel fixed-step clocks
 * is safe here) and owns everything that isn't collision resolution:
 * input decisions, timers, state, and velocity assignment for the next
 * physics step.
 */
export class Player extends InterpolatedPhysicsSprite {
  readonly hurtboxZone: Phaser.GameObjects.Zone;
  readonly buster: BusterWeapon;
  readonly weapons: WeaponController;

  private facing: 1 | -1 = 1;
  private playerState: PlayerState = 'idle';

  private readonly coyoteTimer = new FrameWindow();
  private readonly jumpBuffer = new FrameWindow();
  private readonly dashBuffer = new FrameWindow();
  private readonly jumpEdge = new EdgeDetector();
  private readonly dashEdge = new EdgeDetector();

  private wallKickLockFrames = 0;
  private dashFramesRemaining = 0;
  private dashCooldownFrames = 0;

  // GDD §5: Magma Charge's carry and Umbra Claw's dash-slash both force
  // player movement for a short window, the same "additive locked
  // velocity" pattern as wallKickLockFrames - kept as its own counter
  // rather than reusing that one so a wall-kick and a weapon carry can
  // never silently cancel each other's timing.
  private weaponCarryFramesRemaining = 0;
  private weaponCarryVelocityX = 0;

  // DEBUG TOOL ONLY (see src/systems/debugFlags.ts) - not part of the
  // player kit. Recharges on landing; consumed by performDebugDoubleJump,
  // which is only ever reached when debugFlags.doubleJump is true.
  private debugExtraJumpUsed = false;

  private invulnFramesRemaining = 0;
  private hitstunFramesRemaining = 0;
  private hp: number;
  private readonly maxHp: number;
  private speedMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const { width, height } = playerTuning.size;
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'player-placeholder', width, height, THEME.accentAmber),
    );

    this.maxHp = 16; // GDD §2.3: 16-unit HP bar, base kit (no Heart Chips yet)
    this.hp = this.maxHp;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(width, height);
    body.setGravityY(playerTuning.gravity);
    body.setMaxVelocityY(Math.abs(launchVelocity) * 3);

    this.hurtboxZone = scene.add.zone(
      x,
      y,
      width * playerTuning.hurt.hurtboxScale,
      height * playerTuning.hurt.hurtboxScale,
    );
    scene.physics.add.existing(this.hurtboxZone);
    (this.hurtboxZone.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.buster = new BusterWeapon(scene);
    this.weapons = new WeaponController(scene);
  }

  get currentState(): PlayerState {
    return this.playerState;
  }

  get facingDirection(): 1 | -1 {
    return this.facing;
  }

  get isInvulnerable(): boolean {
    return this.invulnFramesRemaining > 0;
  }

  get hitPoints(): number {
    return this.hp;
  }

  get debugInfo(): {
    state: PlayerState;
    velocityX: number;
    velocityY: number;
    coyoteActive: boolean;
    jumpBufferActive: boolean;
    dashBufferActive: boolean;
    grounded: boolean;
  } {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return {
      state: this.playerState,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      coyoteActive: this.coyoteTimer.isActive,
      jumpBufferActive: this.jumpBuffer.isActive,
      dashBufferActive: this.dashBuffer.isActive,
      grounded: body.blocked.down,
    };
  }

  fixedUpdate(input: InputSnapshot): void {
    // Snapshot the true position physics already settled us at this
    // step, before this step's logic sets velocity for the *next* one.
    this.captureRenderStep();

    const body = this.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down;
    const touchingWallLeft = body.blocked.left;
    const touchingWallRight = body.blocked.right;

    this.tickTimers();

    if (this.hitstunFramesRemaining > 0) {
      this.syncHurtboxAndVisual();
      this.updateState(grounded, touchingWallLeft || touchingWallRight);
      return;
    }

    // --- Coyote time: only counts down while airborne; grounded frames keep it fully armed. ---
    if (grounded) {
      this.coyoteTimer.arm(playerTuning.jump.coyoteFrames);
      this.debugExtraJumpUsed = false; // DEBUG TOOL ONLY - recharge on landing
    } else {
      this.coyoteTimer.tick();
    }

    // --- Jump / wall-kick buffer ---
    const jumpEdgeState = this.jumpEdge.update(input.jumpHeld);
    if (jumpEdgeState.justPressed) {
      this.jumpBuffer.arm(playerTuning.jump.bufferFrames);
    } else {
      this.jumpBuffer.tick();
    }

    const onWall = !grounded && (touchingWallLeft || touchingWallRight);

    if (this.jumpBuffer.isActive) {
      if (grounded || this.coyoteTimer.isActive) {
        this.performJump(body);
      } else if (onWall) {
        this.performWallKick(body, touchingWallLeft);
      } else if (debugFlags.doubleJump && !this.debugExtraJumpUsed) {
        // DEBUG TOOL ONLY - never reached unless explicitly toggled on via
        // the debug overlay in a dev/debug build; a strict sibling branch,
        // not a change to any of the paths above.
        this.performDebugDoubleJump(body);
      }
    }

    // --- Variable jump height: release early = short hop (GDD §2.2) ---
    if (!input.jumpHeld && body.velocity.y < 0) {
      body.setVelocityY(applyJumpCut(body.velocity.y, cutVelocity));
    }

    // --- Wall slide (X-style): airborne, touching a wall, falling. ---
    const wallSliding = onWall && body.velocity.y > playerTuning.wall.slideSpeed;
    if (wallSliding) {
      body.setVelocityY(playerTuning.wall.slideSpeed);
    }

    // --- Dash (STUB - buffered but inert until the Legs Capsule, M6) ---
    const dashEdgeState = this.dashEdge.update(input.dashHeld);
    if (dashEdgeState.justPressed) {
      this.dashBuffer.arm(playerTuning.dash.bufferFrames);
    } else {
      this.dashBuffer.tick();
    }
    this.updateDash(body, grounded);

    // --- Horizontal movement: constant speed, fixed air control, no acceleration curve. ---
    if (this.weaponCarryFramesRemaining > 0) {
      this.weaponCarryFramesRemaining -= 1;
      body.setVelocityX(this.weaponCarryVelocityX);
    } else if (this.wallKickLockFrames > 0) {
      this.wallKickLockFrames -= 1;
    } else if (this.dashFramesRemaining <= 0) {
      body.setVelocityX(input.moveX * playerTuning.run.speed * this.speedMultiplier);
    }

    if (input.moveX !== 0) {
      this.facing = input.moveX;
    }

    // --- Buster / weapon wheel (GDD §2.2/§5): the shoot button fires whichever is currently equipped. ---
    const center = this.bodyCenter;
    const muzzleOffsetX = (playerTuning.size.width / 2 + 3) * this.facing;
    const muzzleX = center.x + muzzleOffsetX;
    const muzzleY = center.y - playerTuning.size.height * 0.15;
    this.buster.fixedUpdate(
      this.weapons.isBusterActive && input.shootHeld,
      muzzleX,
      muzzleY,
      this.facing,
    );
    this.weapons.fixedUpdate(
      input,
      muzzleX,
      muzzleY,
      this.facing,
      center.x,
      center.y,
      (velocityX, frames) => this.applyWeaponCarry(velocityX, frames),
      (frames) => this.grantIFrames(frames),
    );

    this.syncHurtboxAndVisual();
    this.updateState(grounded, onWall);
  }

  private syncHurtboxAndVisual(): void {
    const center = this.bodyCenter;
    this.hurtboxZone.setPosition(center.x, center.y);
    this.visual.setFlipX(this.facing === -1);
    this.updateFlicker();
  }

  /** Scales horizontal run speed for the current step (GDD §3b speed strips); expires unless reapplied every frame. */
  applySpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  /** GDD §5: Magma Charge's forward carry / Umbra Claw's dash-slash - forces horizontal velocity for `frames`, overriding normal input. */
  applyWeaponCarry(velocityX: number, frames: number): void {
    this.weaponCarryVelocityX = velocityX;
    this.weaponCarryFramesRemaining = frames;
  }

  /** GDD §5: Umbra Claw's "10 i-frames" - reuses the same invulnerability window a hurt-recovery grants, just without the damage/knockback that normally comes with it. */
  grantIFrames(frames: number): void {
    this.invulnFramesRemaining = Math.max(this.invulnFramesRemaining, frames);
  }

  /** Bypasses invulnerability entirely (GDD §3b hazard matrix: spikes are always lethal). */
  instaKill(): void {
    this.hp = 0;
  }

  takeDamage(amount: number, sourceX: number): void {
    if (this.isInvulnerable) return;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnFramesRemaining = playerTuning.hurt.invulnFrames;
    this.hitstunFramesRemaining = playerTuning.hurt.hitstunFrames;

    const center = this.bodyCenter;
    const away: 1 | -1 = center.x < sourceX ? -1 : 1;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(center.x + away * playerTuning.hurt.knockbackHopPx, center.y);
    body.setVelocityY(playerTuning.hurt.knockbackHopVelocityY);
    body.setVelocityX(away * playerTuning.run.speed);
    this.snapVisualTo(body.center.x, body.center.y);
  }

  respawnAt(x: number, y: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(x, y);
    this.snapVisualTo(body.center.x, body.center.y);
    this.hitstunFramesRemaining = 0;
    this.invulnFramesRemaining = 0;
    this.hp = this.maxHp;
    this.visual.setVisible(true);
  }

  private performJump(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityY(launchVelocity);
    this.jumpBuffer.consume();
    this.coyoteTimer.consume();
  }

  /** DEBUG TOOL ONLY - testing traversal reachability, not a real ability (see src/systems/debugFlags.ts). */
  private performDebugDoubleJump(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityY(launchVelocity);
    this.jumpBuffer.consume();
    this.debugExtraJumpUsed = true;
  }

  private performWallKick(body: Phaser.Physics.Arcade.Body, wasTouchingLeftWall: boolean): void {
    // Kicking off the left wall pushes right, and vice versa.
    const kickDirection: 1 | -1 = wasTouchingLeftWall ? 1 : -1;
    body.setVelocityY(launchVelocity);
    body.setVelocityX(kickDirection * playerTuning.wall.kickVelocityX);
    this.facing = kickDirection;
    this.wallKickLockFrames = playerTuning.wall.kickLockFrames;
    this.jumpBuffer.consume();
  }

  private updateDash(body: Phaser.Physics.Arcade.Body, grounded: boolean): void {
    if (this.dashCooldownFrames > 0) this.dashCooldownFrames -= 1;

    if (this.dashFramesRemaining > 0) {
      this.dashFramesRemaining -= 1;
      body.setVelocityX(this.facing * playerTuning.dash.speed);
      if (this.dashFramesRemaining === 0)
        this.dashCooldownFrames = playerTuning.dash.cooldownFrames;
      return;
    }

    if (!playerTuning.dash.unlocked) return; // stub: buffered input simply expires, no effect
    if (!this.dashBuffer.isActive) return;
    if (!grounded || this.dashCooldownFrames > 0) return;

    this.dashBuffer.consume();
    this.dashFramesRemaining = playerTuning.dash.durationFrames;
  }

  private tickTimers(): void {
    if (this.invulnFramesRemaining > 0) this.invulnFramesRemaining -= 1;
    if (this.hitstunFramesRemaining > 0) this.hitstunFramesRemaining -= 1;
  }

  private updateFlicker(): void {
    if (this.invulnFramesRemaining <= 0) {
      this.visual.setVisible(true);
      return;
    }
    const phase =
      Math.floor(this.invulnFramesRemaining / playerTuning.hurt.flickerIntervalFrames) % 2;
    this.visual.setVisible(phase === 0);
  }

  private updateState(grounded: boolean, onWall: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.hitstunFramesRemaining > 0) {
      this.playerState = 'hurt';
    } else if (this.dashFramesRemaining > 0) {
      this.playerState = 'dash';
    } else if (!grounded && onWall && body.velocity.y > 0) {
      this.playerState = 'wallSlide';
    } else if (!grounded && body.velocity.y < 0) {
      this.playerState = 'jump';
    } else if (!grounded) {
      this.playerState = 'fall';
    } else if (body.velocity.x !== 0) {
      this.playerState = 'run';
    } else {
      this.playerState = 'idle';
    }
  }
}
