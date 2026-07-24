import Phaser from 'phaser';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { getRectTexture } from '@/systems/placeholderTexture';
import { THEME } from '@/config/theme';
import { magmaRhinoTuning } from '@/config/emberTuning';
import { isWeakness, type WeaponId } from '@/data/weaknessWheel';
type State =
  | 'ritual'
  | 'idle'
  | 'ramTelegraph'
  | 'ram'
  | 'stunned'
  | 'geyserTelegraph'
  | 'hornTelegraph'
  | 'defeated';
export class MagmaRhino extends Enemy {
  private rhinoState: State = 'ritual';
  private f = 0;
  private dir = -1;
  onDefeated: (() => void) | null = null;
  onPlayerContact: ((d: number) => void) | null = null;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private left: number,
    private right: number,
  ) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'magma-rhino', 32, 22, THEME.accentCoral),
      magmaRhinoTuning.maxHp,
    );
    this.isMinor = false;
    this.invulnerable = true;
    (this.body as Phaser.Physics.Arcade.Body).setSize(32, 22).setAllowGravity(true);
  }
  beginRitual(): void {
    this.rhinoState = 'ritual';
    this.f = Math.round(magmaRhinoTuning.fillRitualMs / (1000 / 60));
  }
  applyWeaponHit(w: WeaponId, d: number): void {
    if (isWeakness(w, 'magmaRhino') && !this.invulnerable) {
      this.takeDamage(magmaRhinoTuning.weaknessDamage);
      if (!this.isDead) {
        this.visual.setTintFill(THEME.accentTeal);
        this.enter('stunned', magmaRhinoTuning.stunFrames);
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      }
      return;
    }
    this.takeDamage(d);
  }
  protected onDeath(): void {
    super.onDeath();
    this.rhinoState = 'defeated';
    this.onDefeated?.();
  }
  fixedUpdate(px: number, py: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;
    this.f--;
    const b = this.body as Phaser.Physics.Arcade.Body;
    switch (this.rhinoState) {
      case 'ritual':
        if (this.f <= 0) {
          this.invulnerable = false;
          this.enter('idle', 35);
        }
        break;
      case 'idle':
        if (this.f <= 0) this.startPattern(px);
        break;
      case 'ramTelegraph':
        if (this.f <= 0) {
          this.visual.clearTint();
          this.rhinoState = 'ram';
          this.dir = px < this.x ? -1 : 1;
          b.setVelocityX(this.dir * magmaRhinoTuning.ramSpeed);
        }
        break;
      case 'ram':
        if (this.x < this.left || this.x > this.right) {
          b.setVelocityX(0);
          this.enter('stunned', magmaRhinoTuning.stunFrames);
        }
        break;
      case 'geyserTelegraph':
        if (this.f <= 0) {
          this.visual.clearTint();
          [-48, 0, 48].forEach((off, i) =>
            this.scene.time.delayedCall(i * 180, () =>
              bolts.fire(this.x + off, this.y + 8, 0, -120, 2),
            ),
          );
          this.enter('idle', this.hitPoints <= 4 ? 10 : 35);
        }
        break;
      case 'hornTelegraph':
        if (this.f <= 0) {
          this.visual.clearTint();
          bolts.fire(this.x, this.y - 12, (px - this.x) * 0.7, (py - this.y) * 0.7, 2);
          bolts.fire(this.x, this.y - 12, (px - this.x) * 0.6, -95, 2);
          this.enter('idle', this.hitPoints <= 4 ? 10 : 35);
        }
        break;
      case 'stunned':
        if (this.f <= 0) {
          this.visual.clearTint();
          this.enter('idle', this.hitPoints <= 4 ? 10 : 35);
        }
        break;
    }
  }
  private startPattern(px: number): void {
    const pick = Phaser.Math.Between(0, 2);
    if (pick === 0) {
      this.visual.setTintFill(THEME.accentAmber);
      this.enter('ramTelegraph', magmaRhinoTuning.ramTelegraphFrames);
      this.dir = px < this.x ? -1 : 1;
    } else if (pick === 1) {
      this.visual.setTintFill(THEME.accentAmber);
      this.enter('geyserTelegraph', magmaRhinoTuning.geyserTelegraphFrames);
    } else {
      this.visual.setTintFill(THEME.accentAmber);
      this.enter('hornTelegraph', magmaRhinoTuning.hornTelegraphFrames);
    }
  }
  private enter(s: State, f: number): void {
    this.rhinoState = s;
    this.f = f;
  }
}
