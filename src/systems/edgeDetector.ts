export interface EdgeState {
  held: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * Turns a raw "currently held" boolean into press/release edges, sampled
 * once per fixed 60Hz step. Used for jump/dash buffering and buster
 * charge-release detection, where only the rising/falling edge matters.
 */
export class EdgeDetector {
  private previous = false;

  update(current: boolean): EdgeState {
    const justPressed = current && !this.previous;
    const justReleased = !current && this.previous;
    this.previous = current;
    return { held: current, justPressed, justReleased };
  }
}
