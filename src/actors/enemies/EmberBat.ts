import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { emberBatTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = { width: 14, height: 10 };

type Phase = 'sleep' | 'eyesLight' | 'swoop' | 'cooldown';

/**
 * GDD §3b: ceiling sleeper; eyes light 20f then a U-curve swoop when the
 * player passes below. Hangs at a fixed ceiling anchor until triggered,
 * dips down toward the player and back up to the anchor over `swoopFrames`
 * (a symmetric sine envelope on both axes - x goes anchor -> toward the
 * player -> back to anchor while y dips down and back up in the same
 * envelope, tracing the U), then rests before it can sleep-trigger again.
 */
export class EmberBat extends Enemy {
  private phase: Phase = 'sleep';
  private phaseFramesRemaining = 0;
  private readonly anchorX: number;
  private readonly anchorY: number;
  private swoopTargetX = 0;
  private swoopElapsedFrames = 0;
  private readonly eyes: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'ember-bat', SIZE.width, SIZE.height, THEME.panel),
      emberBatTuning.hp,
    );

    this.anchorX = x;
    this.anchorY = y;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE.width, SIZE.height);

    this.eyes = scene.add.circle(x, y, 1.5, THEME.accentCoral, 0).setVisible(false);
  }

  fixedUpdate(playerX: number, playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) {
      this.eyes.setVisible(false);
      return;
    }
    if (this.tickFrozen()) {
      this.eyes.setVisible(false);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;
    this.phaseFramesRemaining -= 1;

    switch (this.phase) {
      case 'sleep': {
        const belowAndClose =
          playerY > center.y && Math.abs(playerX - center.x) <= emberBatTuning.triggerRangeX;
        if (belowAndClose) {
          this.phase = 'eyesLight';
          this.phaseFramesRemaining = emberBatTuning.eyeGlowFrames;
        }
        break;
      }

      case 'eyesLight': {
        // >=20f telegraph: eyes brighten in place before the swoop (feel pillar #4).
        const progress = 1 - Math.max(0, this.phaseFramesRemaining) / emberBatTuning.eyeGlowFrames;
        this.eyes.setAlpha(progress);
        this.eyes.setRadius(1.5 + progress * 1.5);
        if (this.phaseFramesRemaining <= 0) {
          this.swoopTargetX = playerX;
          this.swoopElapsedFrames = 0;
          this.phase = 'swoop';
          this.phaseFramesRemaining = emberBatTuning.swoopFrames;
        }
        break;
      }

      case 'swoop': {
        this.swoopElapsedFrames += 1;
        const t = Phaser.Math.Clamp(this.swoopElapsedFrames / emberBatTuning.swoopFrames, 0, 1);
        const envelope = Math.sin(t * Math.PI); // 0 at t=0/1, peaks at t=0.5 - traces the U
        const x = this.anchorX + (this.swoopTargetX - this.anchorX) * envelope;
        const y = this.anchorY + emberBatTuning.swoopDepthPx * envelope;
        body.reset(x, y);
        if (this.phaseFramesRemaining <= 0) {
          body.reset(this.anchorX, this.anchorY);
          this.eyes.setVisible(false);
          this.phase = 'cooldown';
          this.phaseFramesRemaining = emberBatTuning.cooldownFrames;
        }
        break;
      }

      case 'cooldown':
        if (this.phaseFramesRemaining <= 0) {
          this.phase = 'sleep';
          this.eyes.setVisible(true).setAlpha(0);
        }
        break;
    }

    if (this.phase === 'eyesLight' || this.phase === 'swoop') this.eyes.setVisible(true);
    this.eyes.setPosition(center.x, center.y - SIZE.height / 2);
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'sleep';
    this.phaseFramesRemaining = 0;
    this.swoopElapsedFrames = 0;
    this.eyes.setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}
