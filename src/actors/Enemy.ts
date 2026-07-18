import type Phaser from 'phaser';
import { InterpolatedPhysicsSprite } from '@/actors/InterpolatedPhysicsSprite';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

/**
 * Shared enemy behavior (GDD §3b universal rules): HP tracking, a hit
 * flash on damage, and death/reset for the checkpoint-driven "enemies
 * reset" rule (GDD §2.4) - reset() re-arms a dead/inactive enemy in
 * place rather than allocating a new instance each retry.
 *
 * `fixedUpdate` has one shared signature across every enemy type (even
 * ones that ignore some of the arguments) so the owning scene can step
 * a mixed `Enemy[]` uniformly instead of switching on concrete type.
 */
export abstract class Enemy extends InterpolatedPhysicsSprite {
  private hp: number;
  private readonly maxHp: number;
  protected invulnerable = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, hp: number) {
    super(scene, x, y, texture);
    this.hp = hp;
    this.maxHp = hp;
  }

  get hitPoints(): number {
    return this.hp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  takeDamage(amount: number): void {
    if (this.invulnerable || this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.scene.tweens.add({ targets: this.visual, alpha: { from: 0.3, to: 1 }, duration: 100 });

    if (this.isDead) this.onDeath();
  }

  protected onDeath(): void {
    this.setActive(false);
    this.visual.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }

  /** Re-arms this enemy at its spawn point (checkpoint reset / re-entering the screen). */
  reset(x: number, y: number): void {
    this.hp = this.maxHp;
    this.invulnerable = false;
    this.setActive(true);
    this.visual.setVisible(true);
    this.visual.setAlpha(1);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.snapVisualTo(x, y);
  }

  abstract fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void;
}
