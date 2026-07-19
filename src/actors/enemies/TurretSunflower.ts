import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { turretSunflowerTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = 16;

type Phase = 'closed' | 'opening' | 'open';

/** GDD §3b: rooted; petals open (24f) -> 3-way spread shot -> closes. Invulnerable while closed. */
export class TurretSunflower extends Enemy {
  private phase: Phase = 'closed';
  private phaseFramesRemaining: number = turretSunflowerTuning.closedFrames;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'turret-sunflower-closed', SIZE, SIZE, THEME.panel),
      turretSunflowerTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(SIZE, SIZE);
    this.invulnerable = true;
  }

  fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;
    if (this.tickFrozen()) return;

    this.phaseFramesRemaining -= 1;
    if (this.phaseFramesRemaining > 0) return;

    switch (this.phase) {
      case 'closed':
        this.phase = 'opening';
        this.phaseFramesRemaining = turretSunflowerTuning.openFrames;
        this.invulnerable = false;
        this.visual.setTexture(
          getRectTexture(this.scene, 'turret-sunflower-open', SIZE, SIZE, THEME.accentCoral),
        );
        break;

      case 'opening': {
        this.phase = 'open';
        this.phaseFramesRemaining = turretSunflowerTuning.openHoldFrames;
        this.fireSpread(playerX, playerY, bolts);
        break;
      }

      case 'open':
        this.phase = 'closed';
        this.phaseFramesRemaining = turretSunflowerTuning.closedFrames;
        this.invulnerable = true;
        this.visual.setTexture(
          getRectTexture(this.scene, 'turret-sunflower-closed', SIZE, SIZE, THEME.panel),
        );
        break;
    }
  }

  private fireSpread(playerX: number, playerY: number, bolts: EnemyProjectilePool): void {
    const center = this.bodyCenter;
    const baseAngle = Math.atan2(playerY - center.y, playerX - center.x);
    const spread = turretSunflowerTuning.spreadAngleRad;

    for (const angle of [baseAngle - spread, baseAngle, baseAngle + spread]) {
      bolts.fire(
        center.x,
        center.y,
        Math.cos(angle) * turretSunflowerTuning.boltSpeed,
        Math.sin(angle) * turretSunflowerTuning.boltSpeed,
        turretSunflowerTuning.boltDamage,
      );
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'closed';
    this.phaseFramesRemaining = turretSunflowerTuning.closedFrames;
    this.invulnerable = true;
    this.visual.setTexture(
      getRectTexture(this.scene, 'turret-sunflower-closed', SIZE, SIZE, THEME.panel),
    );
  }
}
