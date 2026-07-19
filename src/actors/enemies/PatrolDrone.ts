import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { patrolDroneTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = 14;
const TWO_PI = Math.PI * 2;

export interface PatrolDroneOrbit {
  centerX: number;
  centerY: number;
  angleOffsetRad: number;
}

/**
 * GDD §3b: hovers a fixed lane, fires one bolt when the player crosses
 * its sightline (20f lens-flash telegraph first). The mid-boss "twin
 * patrol drones circling a pylon" (§3.1) reuse this same class in orbit
 * mode rather than a bespoke enemy - it's the same enemy, just with a
 * circular flight path instead of a back-and-forth lane.
 */
export class PatrolDrone extends Enemy {
  private readonly patrolMinX: number;
  private readonly patrolMaxX: number;
  private readonly orbit?: PatrolDroneOrbit;
  private orbitAngle: number;
  private facing: 1 | -1 = 1;
  private telegraphFramesRemaining = 0;
  private cooldownFramesRemaining = 0;
  private readonly lens: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { patrolRangeX?: number; orbit?: PatrolDroneOrbit } = {},
  ) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'patrol-drone', SIZE, SIZE, THEME.panel),
      patrolDroneTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE, SIZE);

    this.lens = scene.add.rectangle(x, y, 4, 4, THEME.accentCoral).setDepth(this.visual.depth + 1);

    if (opts.orbit) {
      this.orbit = opts.orbit;
      this.orbitAngle = opts.orbit.angleOffsetRad;
      this.patrolMinX = x;
      this.patrolMaxX = x;
    } else {
      const range = opts.patrolRangeX ?? patrolDroneTuning.patrolRangeX;
      this.patrolMinX = x - range / 2;
      this.patrolMaxX = x + range / 2;
      this.orbitAngle = 0;
      body.setVelocityX(patrolDroneTuning.hoverSpeed);
    }
  }

  fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) {
      this.lens.setVisible(false);
      return;
    }
    if (this.tickFrozen()) {
      this.lens.setVisible(false);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.orbit) {
      this.orbitAngle += TWO_PI / patrolDroneTuning.orbitPeriodFrames;
      const targetX =
        this.orbit.centerX + Math.cos(this.orbitAngle) * patrolDroneTuning.orbitRadius;
      const targetY =
        this.orbit.centerY + Math.sin(this.orbitAngle) * patrolDroneTuning.orbitRadius;
      const prevX = body.center.x;
      body.reset(targetX, targetY);
      this.facing = targetX >= prevX ? 1 : -1;
    } else {
      if (body.center.x <= this.patrolMinX && body.velocity.x < 0) {
        body.setVelocityX(patrolDroneTuning.hoverSpeed);
      } else if (body.center.x >= this.patrolMaxX && body.velocity.x > 0) {
        body.setVelocityX(-patrolDroneTuning.hoverSpeed);
      }
      this.facing = body.velocity.x >= 0 ? 1 : -1;
    }

    if (this.cooldownFramesRemaining > 0) this.cooldownFramesRemaining -= 1;

    const center = this.bodyCenter;
    const sighted =
      this.cooldownFramesRemaining <= 0 &&
      Math.abs(playerY - center.y) <= patrolDroneTuning.sightHalfHeight &&
      ((this.facing === 1 &&
        playerX > center.x &&
        playerX - center.x <= patrolDroneTuning.sightRangeX) ||
        (this.facing === -1 &&
          playerX < center.x &&
          center.x - playerX <= patrolDroneTuning.sightRangeX));

    if (sighted && this.telegraphFramesRemaining === 0) {
      this.telegraphFramesRemaining = patrolDroneTuning.telegraphFrames;
    }

    if (this.telegraphFramesRemaining > 0) {
      this.telegraphFramesRemaining -= 1;
      this.lens.setVisible(true);
      this.lens.setFillStyle(
        this.telegraphFramesRemaining % 4 < 2 ? THEME.accentCoral : THEME.accentAmber,
      );

      if (this.telegraphFramesRemaining === 0) {
        const direction = playerX >= center.x ? 1 : -1;
        bolts.fire(
          center.x,
          center.y,
          direction * patrolDroneTuning.boltSpeed,
          0,
          patrolDroneTuning.boltDamage,
        );
        this.cooldownFramesRemaining = patrolDroneTuning.cooldownFrames;
      }
    } else {
      this.lens.setVisible(false);
    }

    this.lens.setPosition(center.x + this.facing * (SIZE / 2 - 2), center.y);
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.telegraphFramesRemaining = 0;
    this.cooldownFramesRemaining = 0;
    this.lens.setVisible(false);
    if (!this.orbit) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocityX(patrolDroneTuning.hoverSpeed);
    }
  }
}
