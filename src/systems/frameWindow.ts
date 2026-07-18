/**
 * Frame-counted timer for coyote time / input buffering (GDD §2.5: 6
 * frames each). Counts fixed 60Hz simulation steps, not wall-clock time,
 * so it stays exact regardless of display refresh rate.
 */
export class FrameWindow {
  private framesRemaining = 0;

  /** (Re)arm the window for the given number of fixed steps. */
  arm(frames: number): void {
    this.framesRemaining = frames;
  }

  /** Advance one fixed step. Call once per fixedUpdate. */
  tick(): void {
    if (this.framesRemaining > 0) this.framesRemaining -= 1;
  }

  /** True while the window has frames remaining. */
  get isActive(): boolean {
    return this.framesRemaining > 0;
  }

  /** Immediately expire the window (e.g. after consuming it). */
  consume(): void {
    this.framesRemaining = 0;
  }
}
