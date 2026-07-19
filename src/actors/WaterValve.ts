import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { waterValveTuning } from '@/config/enemyTuning';
import type { WaterGate } from '@/actors/WaterGate';

const SIZE = { width: 10, height: 16 };

/**
 * GDD §3.2: a contact-activated lever (touch controls have no dedicated
 * "interact" button, so bumping into it is the whole interface, same
 * spirit as CollapsingBridgeTile's trigger-on-touch). Toggles its linked
 * WaterGate(s) open/closed. Edge-triggered off the player's
 * hurtbox-overlap state (not "every frame overlapping"), plus a short
 * cooldown, so standing on it doesn't rapid-fire toggles.
 */
export class WaterValve {
  readonly zone: Phaser.GameObjects.Zone;
  private readonly visual: Phaser.GameObjects.Rectangle;
  private readonly targetGates: WaterGate[] = [];
  private wasOverlapping = false;
  private cooldownFramesRemaining = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .rectangle(x, y, SIZE.width, SIZE.height, THEME.accentAmber, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, SIZE.width + 6, SIZE.height + 4);
    scene.physics.add.existing(this.zone, true);
  }

  linkGate(gate: WaterGate): void {
    this.targetGates.push(gate);
  }

  /** Call every fixedUpdate with whether the player currently overlaps `zone`. */
  updateOverlap(scene: Phaser.Scene, isOverlapping: boolean): void {
    if (this.cooldownFramesRemaining > 0) this.cooldownFramesRemaining -= 1;

    if (isOverlapping && !this.wasOverlapping && this.cooldownFramesRemaining <= 0) {
      for (const gate of this.targetGates) gate.toggle(scene);
      this.cooldownFramesRemaining = waterValveTuning.toggleCooldownFrames;
      this.visual.setFillStyle(THEME.accentTeal, 0.9);
      scene.tweens.add({
        targets: this.visual,
        duration: 200,
        yoyo: true,
        onComplete: () => this.visual.setFillStyle(THEME.accentAmber, 0.9),
      });
    }
    this.wasOverlapping = isOverlapping;
  }
}
