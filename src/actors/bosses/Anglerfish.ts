import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { anglerfishTuning } from '@/config/bossTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = { width: 20, height: 16 };
const AGGRO_RANGE_PX = 70;

type Phase = 'mimic' | 'reveal' | 'lunge' | 'retreat' | 'cooldown';

/**
 * ANGLERFISH mid-boss (GDD §3.2: "lamp mimic in a dark tunnel"). Disguised
 * as a hanging lamp (idle flicker) until the player gets close; the lure
 * flares as a >=20f telegraph, then it lunges once and retreats to its
 * anchor point to re-mimic. No shutter door/ritual - mid-bosses reuse the
 * regular enemy overlap wiring, same as Speedway's twin Patrol Drones.
 */
export class Anglerfish extends Enemy {
  private phase: Phase = 'mimic';
  private phaseFramesRemaining = 0;
  private readonly anchorX: number;
  private readonly anchorY: number;
  private readonly lure: Phaser.GameObjects.Arc;

  onPlayerContact: ((damage: number) => void) | null = null;
  onDefeated: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'anglerfish', SIZE.width, SIZE.height, THEME.panel),
      anglerfishTuning.maxHp,
    );

    this.anchorX = x;
    this.anchorY = y;
    this.isMinor = false; // a real (mid-)boss fight, not freeze-cheesable

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE.width, SIZE.height);

    this.lure = scene.add.circle(x, y - SIZE.height / 2 - 4, 2, THEME.accentAmber, 0.9);
  }

  fixedUpdate(playerX: number, playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) {
      this.lure.setVisible(false);
      return;
    }
    if (this.tickFrozen()) return;

    this.phaseFramesRemaining -= 1;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;

    switch (this.phase) {
      case 'mimic': {
        const flicker =
          0.5 +
          0.5 *
            Math.sin(
              this.phaseFramesRemaining / (anglerfishTuning.mimicFlickerFrames / (Math.PI * 2)),
            );
        this.lure.setAlpha(flicker);
        const dist = Math.hypot(playerX - center.x, playerY - center.y);
        if (dist <= AGGRO_RANGE_PX) {
          this.phase = 'reveal';
          this.phaseFramesRemaining = anglerfishTuning.revealTelegraphFrames;
        }
        break;
      }

      case 'reveal': {
        const progress =
          1 - Math.max(0, this.phaseFramesRemaining) / anglerfishTuning.revealTelegraphFrames;
        this.lure.setScale(1 + progress * 2.5);
        this.lure.setFillStyle(progress > 0.5 ? THEME.accentCoral : THEME.accentAmber);
        this.lure.setAlpha(1);
        if (this.phaseFramesRemaining <= 0) {
          const dx = playerX - center.x;
          const dy = playerY - center.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          body.setVelocity(
            (dx / dist) * anglerfishTuning.lungeSpeedX,
            (dy / dist) * anglerfishTuning.lungeSpeedY,
          );
          this.phase = 'lunge';
          this.phaseFramesRemaining = anglerfishTuning.lungeFrames;
        }
        break;
      }

      case 'lunge':
        if (this.phaseFramesRemaining <= 0) {
          const dx = this.anchorX - center.x;
          const dy = this.anchorY - center.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          body.setVelocity(
            (dx / dist) * anglerfishTuning.retreatSpeed,
            (dy / dist) * anglerfishTuning.retreatSpeed,
          );
          this.phase = 'retreat';
        }
        break;

      case 'retreat': {
        const dx = this.anchorX - center.x;
        const dy = this.anchorY - center.y;
        if (Math.hypot(dx, dy) < 4) {
          body.reset(this.anchorX, this.anchorY);
          body.setVelocity(0, 0);
          this.lure.setScale(1);
          this.phase = 'cooldown';
          this.phaseFramesRemaining = anglerfishTuning.cooldownFrames;
        }
        break;
      }

      case 'cooldown':
        if (this.phaseFramesRemaining <= 0) this.phase = 'mimic';
        break;
    }

    this.lure.setPosition(center.x, center.y - SIZE.height / 2 - 4);

    if (this.phase === 'lunge') {
      const dx = Math.abs(playerX - center.x);
      const dy = Math.abs(playerY - center.y);
      if (dx < SIZE.width / 2 + 6 && dy < SIZE.height / 2 + 6) {
        this.onPlayerContact?.(anglerfishTuning.contactDamage);
      }
    }
  }

  protected onDeath(): void {
    super.onDeath();
    this.lure.setVisible(false);
    this.onDefeated?.();
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'mimic';
    this.phaseFramesRemaining = 0;
    this.lure.setVisible(true);
    this.lure.setScale(1);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}
