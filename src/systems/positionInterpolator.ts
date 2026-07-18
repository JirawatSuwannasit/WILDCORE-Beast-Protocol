/**
 * Render interpolation for a fixed-step-simulated body (GDD §11.1).
 *
 * Arcade Physics steps at a true fixed 60Hz internally (see
 * `physics.arcade.fps` in gameConfig.ts), decoupled from the render rate
 * - but on a 90/120Hz display, most render frames land between two
 * physics steps with no new position to show, which reads as judder.
 *
 * `capture()` is called once per fixed step with the body's true
 * (post-physics-step) position; `interpolate()` is called once per
 * render frame with `BaseScene#renderAlpha` to blend between the
 * previous and current step for display only. This is pure math with
 * no Phaser dependency on purpose - see
 * `src/actors/InterpolatedPhysicsSprite.ts` for why the interpolated
 * result must be written to a separate, body-less visual GameObject
 * rather than the physics sprite itself.
 */
export class PositionInterpolator {
  private prevX: number;
  private prevY: number;
  private stepX: number;
  private stepY: number;

  constructor(initialX: number, initialY: number) {
    this.prevX = this.stepX = initialX;
    this.prevY = this.stepY = initialY;
  }

  capture(x: number, y: number): void {
    this.prevX = this.stepX;
    this.prevY = this.stepY;
    this.stepX = x;
    this.stepY = y;
  }

  /** Snap both prev/current to the same point, skipping interpolation for one frame (e.g. after a teleport/respawn). */
  reset(x: number, y: number): void {
    this.prevX = this.stepX = x;
    this.prevY = this.stepY = y;
  }

  interpolate(alpha: number): { x: number; y: number } {
    return {
      x: this.prevX + (this.stepX - this.prevX) * alpha,
      y: this.prevY + (this.stepY - this.prevY) * alpha,
    };
  }

  /** How far the body moved on the most recent capture()'d step - e.g. for carrying a moving-platform rider. */
  get stepDelta(): { dx: number; dy: number } {
    return { dx: this.stepX - this.prevX, dy: this.stepY - this.prevY };
  }
}
