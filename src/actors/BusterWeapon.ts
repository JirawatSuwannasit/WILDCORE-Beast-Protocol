import type Phaser from 'phaser';
import { playerTuning } from '@/config/playerTuning';
import { touchLayout } from '@/config/touchLayout';
import { Projectile, type BusterChargeLevel } from '@/actors/Projectile';
import { EdgeDetector } from '@/systems/edgeDetector';
import { FIXED_DT_S } from '@/systems/fixedTimestep';

const LV2_FRAMES = Math.round(playerTuning.buster.chargeLv2Seconds / FIXED_DT_S);
const LV3_FRAMES = Math.round(playerTuning.buster.chargeLv3Seconds / FIXED_DT_S);

/**
 * Owns the fixed-size projectile pool (its size IS the "max 3 on
 * screen" rule, GDD §2.2) and the hold-to-charge timing. Auto-fire mode
 * (GDD §2.2b) trades charging for repeated uncharged shots while held.
 */
export class BusterWeapon {
  private readonly pool: Projectile[];
  private readonly shootEdge = new EdgeDetector();
  private chargeFrames = 0;
  private autoFireCooldown = 0;

  constructor(scene: Phaser.Scene) {
    this.pool = Array.from(
      { length: playerTuning.buster.maxOnScreen },
      () => new Projectile(scene),
    );
  }

  get projectiles(): readonly Projectile[] {
    return this.pool;
  }

  get chargeLevel(): BusterChargeLevel {
    if (this.chargeFrames >= LV3_FRAMES && playerTuning.buster.chargeLv3Unlocked) return 2;
    if (this.chargeFrames >= LV2_FRAMES) return 1;
    return 0;
  }

  get isCharging(): boolean {
    return this.chargeFrames > 0 && !touchLayout.autoFire.enabledDefault;
  }

  fixedUpdate(shootHeld: boolean, originX: number, originY: number, direction: 1 | -1): void {
    if (touchLayout.autoFire.enabledDefault) {
      this.updateAutoFire(shootHeld, originX, originY, direction);
      return;
    }

    const edge = this.shootEdge.update(shootHeld);

    if (edge.held) {
      this.chargeFrames += 1;
    }

    if (edge.justReleased) {
      this.fire(originX, originY, direction, this.chargeLevel);
      this.chargeFrames = 0;
    }
  }

  private updateAutoFire(
    shootHeld: boolean,
    originX: number,
    originY: number,
    direction: 1 | -1,
  ): void {
    if (!shootHeld) {
      this.autoFireCooldown = 0;
      return;
    }

    if (this.autoFireCooldown <= 0) {
      this.fire(originX, originY, direction, 0);
      this.autoFireCooldown = touchLayout.autoFire.intervalFrames;
    } else {
      this.autoFireCooldown -= 1;
    }
  }

  private fire(x: number, y: number, direction: 1 | -1, level: BusterChargeLevel): void {
    const shot = this.pool.find((projectile) => !projectile.active);
    if (!shot) return; // pool exhausted == "max 3 on screen" already in flight
    shot.fire(x, y, direction, level);
  }
}
