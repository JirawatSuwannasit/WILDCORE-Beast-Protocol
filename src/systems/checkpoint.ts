/**
 * Tracks the furthest checkpoint reached (GDD §2.4: start -> midpoint ->
 * pre-boss). Pure/testable: walking back over an earlier checkpoint must
 * not regress the respawn point, so activation only accepts a strictly
 * higher `order` than the best seen so far.
 */
export class CheckpointManager {
  private x: number;
  private y: number;
  private highestOrderReached = -1;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
  }

  tryActivate(order: number, x: number, y: number): boolean {
    if (order <= this.highestOrderReached) return false;
    this.highestOrderReached = order;
    this.x = x;
    this.y = y;
    return true;
  }

  get respawnPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  get lastOrderReached(): number {
    return this.highestOrderReached;
  }
}
