import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { slagBlobTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = 14;

type Phase = 'crawl' | 'inflate' | 'cooldown';

/**
 * GDD §3b: crawls; periodically inflates (glow 24f) then lobs 2 slag arcs.
 * "Slag leaves brief floor flames" is delegated to the owning scene via
 * `onSpawnFlame` (mirrors the `onPlayerContact` callback pattern bosses
 * use) - this class only decides *when* and *where* to ask for one.
 */
export class SlagBlob extends Enemy {
  private phase: Phase = 'crawl';
  private phaseFramesRemaining: number = slagBlobTuning.cooldownFrames;
  private readonly minX: number;
  private readonly maxX: number;
  private facing: 1 | -1 = 1;

  onSpawnFlame: ((x: number, y: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'slag-blob', SIZE, SIZE, THEME.accentCoral),
      slagBlobTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(SIZE, SIZE);
    body.setGravityY(slagBlobTuning.gravity);

    this.minX = x - slagBlobTuning.patrolRangeX / 2;
    this.maxX = x + slagBlobTuning.patrolRangeX / 2;
    body.setVelocityX(slagBlobTuning.crawlSpeed);
  }

  fixedUpdate(playerX: number, _playerY: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;
    if (this.tickFrozen()) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    this.phaseFramesRemaining -= 1;

    switch (this.phase) {
      case 'crawl': {
        const center = this.bodyCenter;
        if (center.x <= this.minX && body.velocity.x < 0) {
          body.setVelocityX(slagBlobTuning.crawlSpeed);
          this.facing = 1;
        } else if (center.x >= this.maxX && body.velocity.x > 0) {
          body.setVelocityX(-slagBlobTuning.crawlSpeed);
          this.facing = -1;
        }
        if (this.phaseFramesRemaining <= 0) {
          this.phase = 'inflate';
          this.phaseFramesRemaining = slagBlobTuning.inflateFrames;
          body.setVelocityX(0);
        }
        break;
      }

      case 'inflate': {
        // >=20f growing glow telegraph (feel pillar #4).
        const progress = 1 - Math.max(0, this.phaseFramesRemaining) / slagBlobTuning.inflateFrames;
        this.visual.setScale(1 + progress * 0.35);
        this.visual.setTintFill(progress > 0.5 ? THEME.accentAmber : THEME.accentCoral);
        if (this.phaseFramesRemaining <= 0) {
          this.fireArcs(playerX, bolts);
          this.visual.clearTint();
          this.visual.setScale(1);
          this.phase = 'cooldown';
          this.phaseFramesRemaining = slagBlobTuning.cooldownFrames;
        }
        break;
      }

      case 'cooldown':
        if (this.phaseFramesRemaining <= 0) {
          this.phase = 'crawl';
          this.phaseFramesRemaining = slagBlobTuning.cooldownFrames;
          body.setVelocityX(this.facing * slagBlobTuning.crawlSpeed);
        }
        break;
    }
  }

  private fireArcs(playerX: number, bolts: EnemyProjectilePool): void {
    const center = this.bodyCenter;
    const direction: 1 | -1 = playerX >= center.x ? 1 : -1;
    const speed = slagBlobTuning.arcSpeed;
    // Two arcs at different heights, both angled toward the facing side -
    // no gravity on enemy bolts (matches every other enemy's projectiles),
    // so the "arc" reads via a shallow vs. a lofted angle rather than a
    // true parabola.
    for (const angle of [-0.15, -0.55]) {
      bolts.fire(
        center.x,
        center.y,
        Math.cos(angle) * speed * direction,
        Math.sin(angle) * speed,
        slagBlobTuning.arcDamage,
      );
    }
    for (const offset of slagBlobTuning.flameOffsetsX) {
      this.onSpawnFlame?.(center.x + offset * direction, center.y);
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'crawl';
    this.phaseFramesRemaining = slagBlobTuning.cooldownFrames;
    this.facing = 1;
    this.visual.clearTint();
    this.visual.setScale(1);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(slagBlobTuning.crawlSpeed);
  }
}
