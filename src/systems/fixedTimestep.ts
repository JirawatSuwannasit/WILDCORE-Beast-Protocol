/** Logic step, per GDD §11.1: fixed 60Hz simulation, decoupled from render rate. */
export const FIXED_DT_MS = 1000 / 60;
export const FIXED_DT_S = 1 / 60;

const MAX_STEPS_PER_FRAME = 5;

/**
 * Accumulator-driven fixed timestep ("fix your timestep"). Scenes feed it
 * the variable render-frame delta; it replays zero or more fixed-size
 * steps and returns an interpolation alpha in [0, 1) for the leftover
 * time, so renderers can blend between the previous and current physics
 * state instead of visibly stepping at 60Hz.
 */
export class FixedTimestepAccumulator {
  private accumulator = 0;

  step(deltaMs: number, onFixedUpdate: (fixedDtMs: number) => void): number {
    // Guard against tab-switch / debugger pauses producing a huge delta
    // that would otherwise force a "spiral of death" of catch-up steps.
    const clampedDelta = Math.min(deltaMs, FIXED_DT_MS * MAX_STEPS_PER_FRAME);
    this.accumulator += clampedDelta;

    let steps = 0;
    while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      onFixedUpdate(FIXED_DT_MS);
      this.accumulator -= FIXED_DT_MS;
      steps += 1;
    }

    return this.accumulator / FIXED_DT_MS;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
