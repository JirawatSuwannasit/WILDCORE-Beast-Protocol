import type Phaser from 'phaser';
import { InterpolatedPhysicsSprite } from '@/actors/InterpolatedPhysicsSprite';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import type { WeaponId } from '@/data/weaknessWheel';
import { TILE_SIZE } from '@/config/playerTuning';

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

  /** GDD §3.4/§5: Frost Talon "freezes minor enemies" - bosses/mid-bosses override this to false. */
  protected isMinor = true;
  private frozenFramesRemaining = 0;
  private preFreezeInvulnerable = false;
  private readonly freezePlatform: Phaser.Physics.Arcade.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, hp: number) {
    super(scene, x, y, texture);
    this.hp = hp;
    this.maxHp = hp;

    // A separate static collider (not this enemy's own body) that stands
    // in for it while frozen - simpler and safer than repurposing a
    // moving/AI-driven body as a walkable platform, and it survives the
    // enemy's own death/reset cycle independently.
    this.freezePlatform = scene.physics.add
      .staticImage(x, y, texture)
      .setSize(TILE_SIZE, TILE_SIZE)
      .setVisible(false);
    (this.freezePlatform.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  get hitPoints(): number {
    return this.hp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  get isFrozen(): boolean {
    return this.frozenFramesRemaining > 0;
  }

  /** The static body a player can stand on while this enemy is frozen (GDD §3.4: "temporary platforms"). */
  get platformBody(): Phaser.Physics.Arcade.Image {
    return this.freezePlatform;
  }

  takeDamage(amount: number): void {
    if (this.invulnerable || this.isDead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.scene.tweens.add({ targets: this.visual, alpha: { from: 0.3, to: 1 }, duration: 100 });

    if (this.isDead) this.onDeath();
  }

  /**
   * Generic weapon-hit entry point every weapon effect calls (GDD §4:
   * a boss's weakness weapon does fixed damage + interrupt + reaction;
   * every other hit is just its own damage). Regular enemies never
   * override this - only bosses (see VoltCheetah) special-case it.
   */
  applyWeaponHit(_weaponId: WeaponId, damage: number): void {
    this.takeDamage(damage);
  }

  /** Frost Talon (GDD §3.4): freezes this enemy solid and stands a 1-tile platform over it for `frames`. No-op (returns false) on bosses/mid-bosses or a dead enemy. */
  freeze(frames: number): boolean {
    if (!this.isMinor || this.isDead) return false;

    if (!this.isFrozen) this.preFreezeInvulnerable = this.invulnerable;
    this.frozenFramesRemaining = frames;
    this.invulnerable = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    const center = this.bodyCenter;
    this.freezePlatform.setPosition(center.x, center.y);
    this.freezePlatform.setVisible(true);
    const platformBody = this.freezePlatform.body as Phaser.Physics.Arcade.StaticBody;
    platformBody.enable = true;
    platformBody.updateFromGameObject();
    return true;
  }

  /** Call once per fixedUpdate, before any AI logic; returns true while still frozen (AI should skip its step). */
  protected tickFrozen(): boolean {
    if (this.frozenFramesRemaining <= 0) return false;

    this.frozenFramesRemaining -= 1;
    if (this.frozenFramesRemaining <= 0) this.thaw();
    return true;
  }

  private thaw(): void {
    this.invulnerable = this.preFreezeInvulnerable;
    this.freezePlatform.setVisible(false);
    (this.freezePlatform.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  protected onDeath(): void {
    this.setActive(false);
    this.visual.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    if (this.isFrozen) {
      this.frozenFramesRemaining = 0;
      this.freezePlatform.setVisible(false);
      (this.freezePlatform.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
  }

  /** Re-arms this enemy at its spawn point (checkpoint reset / re-entering the screen). */
  reset(x: number, y: number): void {
    this.hp = this.maxHp;
    this.invulnerable = false;
    this.setActive(true);
    this.visual.setVisible(true);
    this.visual.setAlpha(1);
    this.frozenFramesRemaining = 0;
    this.freezePlatform.setVisible(false);
    (this.freezePlatform.body as Phaser.Physics.Arcade.StaticBody).enable = false;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.snapVisualTo(x, y);
  }

  abstract fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void;
}
