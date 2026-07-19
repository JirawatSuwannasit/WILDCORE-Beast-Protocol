import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { dartFishTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = { width: 12, height: 8 };

type Phase = 'idle' | 'wiggle' | 'dash';

/** GDD §3b: idles in water; wiggles 20f, then dashes in a straight line. Dies to one hit but fast. */
export class DartFish extends Enemy {
  private phase: Phase = 'idle';
  private phaseFramesRemaining: number = dartFishTuning.idleFrames;
  private dashDirection: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'dart-fish', SIZE.width, SIZE.height, THEME.accentTeal),
      dartFishTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE.width, SIZE.height);
  }

  fixedUpdate(playerX: number, _playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;
    if (this.tickFrozen()) return;

    this.phaseFramesRemaining -= 1;
    const body = this.body as Phaser.Physics.Arcade.Body;

    switch (this.phase) {
      case 'idle':
        if (this.phaseFramesRemaining <= 0) {
          this.phase = 'wiggle';
          this.phaseFramesRemaining = dartFishTuning.wiggleFrames;
        }
        this.visual.setAngle(0);
        break;

      case 'wiggle': {
        // Growing shake telegraph (GDD feel pillar #4: >=20f wind-up).
        const progress = 1 - Math.max(0, this.phaseFramesRemaining) / dartFishTuning.wiggleFrames;
        this.visual.setAngle(Math.sin(progress * 40) * 12);
        if (this.phaseFramesRemaining <= 0) {
          this.dashDirection = playerX >= this.bodyCenter.x ? 1 : -1;
          body.setVelocityX(this.dashDirection * dartFishTuning.dashSpeed);
          this.phase = 'dash';
          this.phaseFramesRemaining = dartFishTuning.dashFrames;
          this.visual.setAngle(0);
        }
        break;
      }

      case 'dash':
        if (this.phaseFramesRemaining <= 0) {
          body.setVelocity(0, 0);
          this.phase = 'idle';
          this.phaseFramesRemaining = dartFishTuning.idleFrames;
        }
        break;
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'idle';
    this.phaseFramesRemaining = dartFishTuning.idleFrames;
    this.visual.setAngle(0);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}
