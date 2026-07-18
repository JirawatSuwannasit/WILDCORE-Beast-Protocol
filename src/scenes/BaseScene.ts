import Phaser from 'phaser';
import { FixedTimestepAccumulator } from '@/systems/fixedTimestep';

/**
 * Base class for every WILDCORE scene. Phaser calls `update(time, delta)`
 * once per render frame at a variable rate; this replays `fixedUpdate` at a
 * true 60Hz and exposes `renderAlpha` (0..1) so a scene can interpolate
 * sprite transforms between the previous and current fixed step instead of
 * visibly snapping (GDD §11.1: fixed 60Hz logic, render interpolation).
 */
export abstract class BaseScene extends Phaser.Scene {
  private readonly accumulator = new FixedTimestepAccumulator();

  /** Interpolation factor for the render frame currently being drawn. */
  protected renderAlpha = 0;

  update(time: number, delta: number): void {
    this.renderAlpha = this.accumulator.step(delta, (fixedDtMs) => {
      this.fixedUpdate(fixedDtMs, time);
    });
  }

  /** Override in subclasses that need deterministic 60Hz simulation. */
  protected fixedUpdate(_fixedDtMs: number, _time: number): void {
    // no-op by default; scene stubs have nothing to simulate yet.
  }

  shutdown(): void {
    this.accumulator.reset();
  }
}
