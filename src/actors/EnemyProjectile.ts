import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';

const SIZE = 5;
const MAX_FLIGHT_MS = 2500;

/** Pooled enemy bolt - same flight-time-based despawn as the player's Projectile (see DECISIONS.md). */
export class EnemyProjectile extends Phaser.Physics.Arcade.Sprite {
  private damageAmount = 0;
  private flightMs = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, -100, -100, getRectTexture(scene, 'enemy-bolt', SIZE, SIZE, THEME.accentCoral));
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

  fire(x: number, y: number, velocityX: number, velocityY: number, damage: number): void {
    this.damageAmount = damage;
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.flightMs = 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(velocityX, velocityY);
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
    if (this.flightMs > MAX_FLIGHT_MS) {
      this.deactivate();
    }
  }
}

/** Shared pool - enemies fire infrequently, so a handful of bolts easily covers every enemy on screen. */
export class EnemyProjectilePool {
  private readonly pool: EnemyProjectile[];

  constructor(scene: Phaser.Scene, size = 6) {
    this.pool = Array.from({ length: size }, () => new EnemyProjectile(scene));
  }

  get projectiles(): readonly EnemyProjectile[] {
    return this.pool;
  }

  fire(x: number, y: number, velocityX: number, velocityY: number, damage: number): void {
    const shot = this.pool.find((p) => !p.active);
    shot?.fire(x, y, velocityX, velocityY, damage);
  }
}
