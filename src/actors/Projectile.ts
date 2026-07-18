import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { playerTuning } from '@/config/playerTuning';
import { getRectTexture } from '@/systems/placeholderTexture';

/** 0 = uncharged tap, 1 = Lv2 (>=0.5s hold), 2 = Lv3 (>=1.2s hold, Arms-gated). */
export type BusterChargeLevel = 0 | 1 | 2;

const LEVEL_COLOR: Record<BusterChargeLevel, number> = {
  0: THEME.textCreamHex,
  1: THEME.accentAmber,
  2: THEME.accentCoral,
};

function sizeForLevel(level: BusterChargeLevel): number {
  const sizes = playerTuning.buster.projectileSize;
  return level === 2 ? sizes.lv3 : level === 1 ? sizes.lv2 : sizes.uncharged;
}

function damageForLevel(level: BusterChargeLevel): number {
  const damage = playerTuning.buster.damage;
  return level === 2 ? damage.lv3 : level === 1 ? damage.lv2 : damage.uncharged;
}

/**
 * A single pooled buster shot. The pool size (see BusterWeapon) IS the
 * "max 3 bullets on screen" rule (GDD §2.2) - there's simply nothing to
 * fire a 4th shot with while all 3 are in flight.
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private damageAmount = 0;
  private flightMs = 0;

  constructor(scene: Phaser.Scene) {
    super(
      scene,
      -100,
      -100,
      getRectTexture(scene, 'buster-lv0', sizeForLevel(0), sizeForLevel(0), LEVEL_COLOR[0]),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
  }

  get damage(): number {
    return this.damageAmount;
  }

  fire(x: number, y: number, direction: 1 | -1, level: BusterChargeLevel): void {
    const size = sizeForLevel(level);
    const key = getRectTexture(this.scene, `buster-lv${level}`, size, size, LEVEL_COLOR[level]);
    this.setTexture(key);
    this.damageAmount = damageForLevel(level);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setSize(size, size);
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.flightMs = 0;
    body.setVelocity(playerTuning.buster.speed * direction, 0);
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    this.flightMs += delta;
    if (this.flightMs > playerTuning.buster.maxFlightMs) {
      this.deactivate();
    }
  }
}
