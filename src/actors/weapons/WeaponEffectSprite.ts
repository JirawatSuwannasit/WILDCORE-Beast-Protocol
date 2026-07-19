import Phaser from 'phaser';
import { getRectTexture } from '@/systems/placeholderTexture';
import { THEME } from '@/config/theme';
import type { WeaponId } from '@/data/weaknessWheel';
import type { Enemy } from '@/actors/Enemy';

const DEFAULT_MAX_FLIGHT_MS = 2000;

/**
 * One pooled instance of an active weapon effect (GDD §5): a traveling
 * projectile for most weapons, or a following melee hitbox for Umbra
 * Claw's dash-slash. Mirrors `Projectile.ts`'s pooling shape - it only
 * owns its own position/velocity/despawn timer; every behavior decision
 * (chaining, splash, freezing, sticking, boomerang turn, ground-wave
 * wall turn) is driven by `WeaponController.fixedUpdate` on the fixed
 * 60Hz step, reading/writing the small bag of per-instance state below.
 */
export class WeaponEffectSprite extends Phaser.Physics.Arcade.Sprite {
  weaponId: WeaponId | null = null;

  /** Enemies this instance has already applied a hit to - needed by piercing/lingering effects (Magma Charge, the boomerang, the ground wave) so one overlap-per-physics-step doesn't restack damage. */
  readonly alreadyHit = new Set<Enemy>();

  /**
   * Boomerang (Gale Cutter): launch point, to measure travel distance
   * against its max range. Deliberately NOT named originX/originY -
   * those names collide with Phaser's own GameObject.originX/originY
   * (the normalized 0-1 anchor point used by getTopLeft()/getBounds()/
   * body.reset() to compute world position from the display transform);
   * shadowing them here corrupted every body-position sync on this
   * class. See DECISIONS.md.
   */
  launchX = 0;
  launchY = 0;
  boomerangReturning = false;

  /** Ground wave (Terra Spike): has it already turned from floor travel to wall climb once? */
  groundWaveTurned = false;

  /** Sticky DoT (Venom Sting): the enemy this dart is stuck to, and its remaining tick/duration timers (fixed steps). */
  stuckTo: Enemy | null = null;
  dotTicksRemaining = 0;
  dotTickFramesRemaining = 0;

  /** Generic fixed-step duration counter for behaviors that aren't flight-time-based (Umbra Claw's dash-slash). */
  activeFramesRemaining = 0;

  private flightMs = 0;
  private maxFlightMs = DEFAULT_MAX_FLIGHT_MS;

  constructor(scene: Phaser.Scene) {
    super(
      scene,
      -100,
      -100,
      getRectTexture(scene, 'weapon-effect-default', 4, 4, THEME.accentTeal),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
  }

  fire(
    weaponId: WeaponId,
    x: number,
    y: number,
    texture: string,
    size: number,
    maxFlightMs: number,
  ): void {
    this.weaponId = weaponId;
    this.alreadyHit.clear();
    this.launchX = x;
    this.launchY = y;
    this.boomerangReturning = false;
    this.groundWaveTurned = false;
    this.stuckTo = null;
    this.dotTicksRemaining = 0;
    this.dotTickFramesRemaining = 0;
    this.activeFramesRemaining = 0;
    this.flightMs = 0;
    this.maxFlightMs = maxFlightMs;

    this.setTexture(texture);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setSize(size, size);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.weaponId = null;
    this.stuckTo = null;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    // Stuck darts and the dash-slash hitbox despawn on their own
    // fixed-step duration counters (see WeaponController), not this
    // render-frame flight-time clock.
    if (this.stuckTo || this.activeFramesRemaining > 0) return;

    this.flightMs += delta;
    if (this.flightMs > this.maxFlightMs) this.deactivate();
  }
}
