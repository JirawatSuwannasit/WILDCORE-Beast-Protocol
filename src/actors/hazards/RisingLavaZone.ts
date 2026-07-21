import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { risingLavaTuning } from '@/config/enemyTuning';

/**
 * GDD §3.3 setpiece: the rising-lava chase - a forced vertical ascent. Same
 * trigger/rise shape as Reservoir's `RisingWaterZone` (inert until
 * `trigger()`, then the surface climbs at a steady rate up to a ceiling
 * row and holds there), but LETHAL instead of an assist: anything the
 * surface catches up to is an instant kill, matching the hazard matrix's
 * "Rising/standing lava ... 4 + knockback" contact rule at the point of
 * first touch (an instaKill reads as "caught by the chase" - the same
 * severity Mega Man-style lava chases use, and consistent with spikes'
 * precedent of an outright `instaKill()` for a lethal hazard rather than a
 * chip-damage tick). The rising surface itself is the whole telegraph -
 * continuously visible the entire time it climbs, same as the water
 * precedent - so nothing about it can appear "instant" or unreadable.
 */
export class RisingLavaZone {
  private readonly x: number;
  private readonly halfWidth: number;
  private readonly bottomY: number;
  private readonly ceilingY: number;
  private surfaceY: number;
  private triggered = false;
  private readonly visual: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, width: number, bottomY: number, ceilingY: number) {
    this.x = x;
    this.halfWidth = width / 2;
    this.bottomY = bottomY;
    this.ceilingY = ceilingY;
    this.surfaceY = bottomY;

    this.visual = scene.add
      .rectangle(x, bottomY, width, 1, THEME.accentCoral, 0.75)
      .setOrigin(0.5, 1)
      .setDepth(-1);
  }

  trigger(): void {
    this.triggered = true;
  }

  /** Whether `(px, py)` is caught by the current lava surface, within the chase shaft's width. */
  overlaps(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.halfWidth && py >= this.surfaceY && py <= this.bottomY;
  }

  fixedUpdate(): void {
    if (this.triggered && this.surfaceY > this.ceilingY) {
      this.surfaceY = Math.max(
        this.ceilingY,
        this.surfaceY - risingLavaTuning.riseSpeedPxPerSec / 60,
      );
    }
    this.visual.setSize(this.halfWidth * 2, Math.max(1, this.bottomY - this.surfaceY));
    this.visual.setPosition(this.x, this.bottomY);
  }
}
