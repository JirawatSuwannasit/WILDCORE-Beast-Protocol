import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';

/**
 * GDD §3b hazard: stationary reef hazard, always visible, contact damage
 * (not lethal, unlike spikes). No telegraph needed - it never attacks,
 * it just sits in the path like an obstacle you route around.
 */
export class ToxicUrchin {
  readonly hazardZone: Phaser.Physics.Arcade.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.hazardZone = scene.physics.add.staticImage(
      x,
      y,
      getRectTexture(scene, `toxic-urchin-${width}x${height}`, width, height, THEME.accentCoral),
    );
  }
}
