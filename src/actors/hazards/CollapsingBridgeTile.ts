import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { collapsingBridgeTuning } from '@/config/enemyTuning';

type Phase = 'stable' | 'cracking' | 'gone';

/** GDD §3b: crack/wobble telegraph (24f) before giving way. Resets on a timer, independent of checkpoints, so a retry never finds a still-broken bridge. */
export class CollapsingBridgeTile extends Phaser.Physics.Arcade.Sprite {
  private phase: Phase = 'stable';
  private framesRemaining = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, `bridge-${width}x${height}`, width, height, THEME.panel),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
  }

  trigger(): void {
    if (this.phase !== 'stable') return;
    this.phase = 'cracking';
    this.framesRemaining = collapsingBridgeTuning.crackFrames;
  }

  fixedUpdate(): void {
    if (this.framesRemaining < 0) return;

    this.framesRemaining -= 1;

    if (this.phase === 'cracking') {
      this.setAlpha(this.framesRemaining % 6 < 3 ? 1 : 0.4);
      if (this.framesRemaining <= 0) {
        this.phase = 'gone';
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.framesRemaining = collapsingBridgeTuning.respawnFrames;
      }
    } else if (this.phase === 'gone' && this.framesRemaining <= 0) {
      this.phase = 'stable';
      this.setVisible(true);
      this.setAlpha(1);
      this.framesRemaining = -1;
      (this.body as Phaser.Physics.Arcade.StaticBody).enable = true;
    }
  }
}
