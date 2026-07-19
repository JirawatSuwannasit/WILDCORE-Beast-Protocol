import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { sparkBugTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = 10;

/** GDD §3b: hops toward the player in readable arcs, sparks grow just before each hop. Contact only. */
export class SparkBug extends Enemy {
  private framesUntilHop = sparkBugTuning.hopIntervalFrames;
  private readonly spark: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'spark-bug', SIZE, SIZE, THEME.accentAmber),
      sparkBugTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(SIZE, SIZE);
    body.setGravityY(sparkBugTuning.gravity);

    this.spark = scene.add.circle(x, y - SIZE / 2, 1, THEME.textCreamHex).setVisible(false);
  }

  fixedUpdate(playerX: number, _playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) {
      this.spark.setVisible(false);
      return;
    }
    if (this.tickFrozen()) {
      this.spark.setVisible(false);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;

    if (body.blocked.down) {
      this.framesUntilHop -= 1;

      if (this.framesUntilHop <= sparkBugTuning.telegraphFrames) {
        const progress = 1 - Math.max(0, this.framesUntilHop) / sparkBugTuning.telegraphFrames;
        this.spark.setVisible(true);
        this.spark.setRadius(1 + progress * 4);
        this.spark.setPosition(center.x, center.y - SIZE / 2 - 2);
      }

      if (this.framesUntilHop <= 0) {
        const direction: 1 | -1 = playerX >= center.x ? 1 : -1;
        body.setVelocityX(direction * sparkBugTuning.hopVelocityX);
        body.setVelocityY(sparkBugTuning.hopVelocityY);
        this.framesUntilHop = sparkBugTuning.hopIntervalFrames;
        this.spark.setVisible(false);
      }
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.framesUntilHop = sparkBugTuning.hopIntervalFrames;
    this.spark.setVisible(false);
  }
}
