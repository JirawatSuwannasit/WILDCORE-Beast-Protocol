import Phaser from 'phaser';
import { PositionInterpolator } from '@/systems/positionInterpolator';

/**
 * Base for any Arcade-physics-driven actor that needs smooth render
 * interpolation on high-refresh-rate displays (GDD §11.1).
 *
 * Arcade Body re-adopts its owning GameObject's transform as the
 * authoritative simulation position on *every* render frame
 * (`Body.preUpdate` -> `updateFromGameObject`, unconditionally, not
 * just on frames where a physics step runs). That means writing an
 * interpolated (non-integer-step) position directly onto the physics
 * sprite's own x/y would get read back in as real simulation state and
 * corrupt it - so the physics sprite here stays invisible and drives
 * only collision; a separate plain `visual` sprite (no body, so no
 * feedback risk) is what's actually shown, positioned by interpolating
 * between the last two true fixed-step positions. See DECISIONS.md.
 */
export abstract class InterpolatedPhysicsSprite extends Phaser.Physics.Arcade.Sprite {
  readonly visual: Phaser.GameObjects.Sprite;
  private readonly interpolator: PositionInterpolator;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);

    this.visual = scene.add.sprite(x, y, texture);
    this.interpolator = new PositionInterpolator(x, y);
  }

  /** The true, current simulation position (not the stale sprite transform - see class doc). */
  protected get bodyCenter(): Phaser.Math.Vector2 {
    return (this.body as Phaser.Physics.Arcade.Body).center;
  }

  /** Call once at the start of each fixed step, before changing velocity for the next one. */
  protected captureRenderStep(): void {
    const center = this.bodyCenter;
    this.interpolator.capture(center.x, center.y);
  }

  /** How far this body moved on the most recently captured step - e.g. to carry a moving-platform rider. */
  get stepDelta(): { dx: number; dy: number } {
    return this.interpolator.stepDelta;
  }

  /** Collapses interpolation to a single point (e.g. after a teleport/respawn/knockback reset). */
  protected snapVisualTo(x: number, y: number): void {
    this.interpolator.reset(x, y);
    this.visual.setPosition(x, y);
  }

  /** Call once per render frame with BaseScene#renderAlpha. */
  updateRenderPosition(alpha: number): void {
    const { x, y } = this.interpolator.interpolate(alpha);
    this.visual.setPosition(x, y);
  }

  destroyBoth(): void {
    this.visual.destroy();
    this.destroy();
  }
}
