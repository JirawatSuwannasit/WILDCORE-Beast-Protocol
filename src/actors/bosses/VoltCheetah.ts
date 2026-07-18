import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { voltCheetahTuning } from '@/config/bossTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';

const SIZE = { width: 22, height: 18 };
const IDLE_FRAMES = 45;
const POUNCE_LANDING_RECOVER_FRAMES = 24;
const WEAKNESS_STUN_FRAMES = 30;
const SWEEP_TRAVEL_MARGIN = 40;

type PatternId = 'dash' | 'pounce' | 'sweep';
type State =
  | 'ritual'
  | 'idle'
  | 'crouch'
  | 'dash'
  | 'pounceTelegraph'
  | 'pounceAir'
  | 'pounceRecover'
  | 'sweepTelegraph'
  | 'sweepActive'
  | 'recover'
  | 'stunned'
  | 'defeated';

/**
 * VOLT CHEETAH (GDD §3.1 / §4). 3 core patterns, all dodgeable with the
 * buster alone; a weakness hit (stubbed - M3 wires a real weapon ID in)
 * does fixed damage and interrupts whatever is happening. Below 25% HP,
 * patterns chain back-to-back instead of pausing between them.
 */
export class VoltCheetah extends Enemy {
  private bossFsmState: State = 'ritual';
  private framesRemaining = 0;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;
  private readonly floorY: number;
  private dashSpeedIndex = 0;
  private dashDirection: 1 | -1 = 1;
  private desperationQueued: PatternId | null = null;

  private readonly sweepHazard: Phaser.GameObjects.Rectangle;
  private sweepDirection: 1 | -1 = 1;
  private sweepX = 0;

  onPlayerContact: ((damage: number) => void) | null = null;
  onSweepContact: ((damage: number) => void) | null = null;
  onDefeated: (() => void) | null = null;
  onReaction: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, arenaLeft: number, arenaRight: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'volt-cheetah', SIZE.width, SIZE.height, THEME.accentAmber),
      voltCheetahTuning.maxHp,
    );

    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.floorY = y;
    this.invulnerable = true; // during the fill ritual

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(voltCheetahTuning.wallPounce.gravity);
    body.setSize(SIZE.width, SIZE.height);
    body.setCollideWorldBounds(false);

    this.sweepHazard = scene.add
      .rectangle(x, y, 12, voltCheetahTuning.floorSweep.height, THEME.accentCoral, 0.9)
      .setVisible(false);
  }

  get isInvulnerable(): boolean {
    return this.invulnerable;
  }

  get bossState(): State {
    return this.bossFsmState;
  }

  /** Called once the shutter doors finish closing; starts the HP-fill ritual. */
  beginRitual(): void {
    this.bossFsmState = 'ritual';
    this.framesRemaining = Math.round(voltCheetahTuning.fillRitualMs / (1000 / 60));
  }

  takesWeakness(_weaponId: string): void {
    if (this.isDead || this.bossFsmState === 'ritual' || this.bossFsmState === 'defeated') return;
    this.takeDamage(voltCheetahTuning.weaknessDamage);
    if (this.isDead) return;
    this.onReaction?.();
    this.enterState('stunned', WEAKNESS_STUN_FRAMES);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.sweepHazard.setVisible(false);
  }

  protected onDeath(): void {
    super.onDeath();
    this.bossFsmState = 'defeated';
    this.sweepHazard.setVisible(false);
    this.onDefeated?.();
  }

  fixedUpdate(playerX: number, playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;

    this.framesRemaining -= 1;

    switch (this.bossFsmState) {
      case 'ritual':
        if (this.framesRemaining <= 0) {
          this.invulnerable = false;
          this.enterState('idle', IDLE_FRAMES);
        }
        break;

      case 'idle':
        if (this.framesRemaining <= 0) this.startPattern(this.pickPattern(), playerX, playerY);
        break;

      case 'crouch':
        if (this.framesRemaining <= 0) this.launchDash();
        break;

      case 'dash':
        this.updateDash();
        break;

      case 'pounceTelegraph':
        if (this.framesRemaining <= 0) this.launchPounce(playerX);
        break;

      case 'pounceAir':
        this.updatePounceAir();
        break;

      case 'pounceRecover':
      case 'recover':
      case 'stunned':
        if (this.framesRemaining <= 0) this.finishPattern();
        break;

      case 'sweepTelegraph':
        if (this.framesRemaining <= 0) this.launchSweep();
        break;

      case 'sweepActive':
        this.updateSweep();
        break;

      case 'defeated':
        break;
    }

    this.checkContactDamage(playerX, playerY);
  }

  private enterState(state: State, frames: number): void {
    this.bossFsmState = state;
    this.framesRemaining = frames;
  }

  private pickPattern(): PatternId {
    const order: PatternId[] = ['dash', 'pounce', 'sweep'];
    return order[Phaser.Math.Between(0, order.length - 1)] ?? 'dash';
  }

  private startPattern(pattern: PatternId, playerX: number, playerY: number): void {
    if (pattern === 'dash') {
      this.dashSpeedIndex = Phaser.Math.Between(0, voltCheetahTuning.dash.speeds.length - 1);
      const crouchFrames = voltCheetahTuning.dash.crouchFramesBySpeed[this.dashSpeedIndex] ?? 30;
      this.enterState('crouch', crouchFrames);
    } else if (pattern === 'pounce') {
      void playerY;
      this.enterState('pounceTelegraph', voltCheetahTuning.wallPounce.telegraphFrames);
    } else {
      this.sweepDirection = this.bodyCenter.x <= (this.arenaLeft + this.arenaRight) / 2 ? 1 : -1;
      this.enterState('sweepTelegraph', voltCheetahTuning.floorSweep.telegraphFrames);
    }
    void playerX;
  }

  private launchDash(): void {
    const center = this.bodyCenter;
    this.dashDirection = center.x <= (this.arenaLeft + this.arenaRight) / 2 ? 1 : -1;
    const speed =
      voltCheetahTuning.dash.speeds[this.dashSpeedIndex] ?? voltCheetahTuning.dash.speeds[0] ?? 100;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.dashDirection * speed);
    this.bossFsmState = 'dash';
  }

  private updateDash(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;
    const reachedWall =
      (this.dashDirection === 1 && center.x >= this.arenaRight - SIZE.width / 2) ||
      (this.dashDirection === -1 && center.x <= this.arenaLeft + SIZE.width / 2);

    if (reachedWall) {
      body.setVelocityX(0);
      this.enterState('recover', voltCheetahTuning.dash.recoverFrames);
    }
  }

  private launchPounce(playerX: number): void {
    const center = this.bodyCenter;
    const towardPlayer: 1 | -1 = playerX >= center.x ? 1 : -1;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(towardPlayer * voltCheetahTuning.wallPounce.launchVelocityX);
    body.setVelocityY(voltCheetahTuning.wallPounce.launchVelocityY);
    this.bossFsmState = 'pounceAir';
  }

  private updatePounceAir(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && body.velocity.y >= 0) {
      body.setVelocityX(0);
      this.enterState('pounceRecover', POUNCE_LANDING_RECOVER_FRAMES);
    }
  }

  private launchSweep(): void {
    const center = this.bodyCenter;
    this.sweepX = center.x;
    this.sweepHazard.setVisible(true);
    this.sweepHazard.setPosition(this.sweepX, this.floorY);
    this.bossFsmState = 'sweepActive';
  }

  private updateSweep(): void {
    this.sweepX += this.sweepDirection * voltCheetahTuning.floorSweep.travelSpeed * (1 / 60);
    this.sweepHazard.setPosition(this.sweepX, this.floorY);

    const overshootLeft = this.sweepX < this.arenaLeft - SWEEP_TRAVEL_MARGIN;
    const overshootRight = this.sweepX > this.arenaRight + SWEEP_TRAVEL_MARGIN;
    if (overshootLeft || overshootRight) {
      this.sweepHazard.setVisible(false);
      this.enterState('recover', voltCheetahTuning.dash.recoverFrames);
    }
  }

  private finishPattern(): void {
    if (this.hpFraction() < voltCheetahTuning.desperationHpFraction && !this.desperationQueued) {
      this.desperationQueued = this.pickPattern();
      this.enterState('recover', voltCheetahTuning.desperation.linkFrames);
      return;
    }
    if (this.desperationQueued) {
      const next = this.desperationQueued;
      this.desperationQueued = null;
      this.startPattern(next, this.bodyCenter.x, this.floorY);
      return;
    }
    this.enterState('idle', IDLE_FRAMES);
  }

  private hpFraction(): number {
    return this.hitPoints / voltCheetahTuning.maxHp;
  }

  private checkContactDamage(playerX: number, playerY: number): void {
    if (this.bossFsmState === 'ritual' || this.bossFsmState === 'defeated') return;

    const center = this.bodyCenter;
    const dx = Math.abs(playerX - center.x);
    const dy = Math.abs(playerY - center.y);
    if (dx < SIZE.width / 2 + 6 && dy < SIZE.height / 2 + 8) {
      this.onPlayerContact?.(voltCheetahTuning.contactDamage);
    }

    if (this.bossFsmState === 'sweepActive') {
      const sweepDx = Math.abs(playerX - this.sweepX);
      if (sweepDx < 8 && Math.abs(playerY - this.floorY) < voltCheetahTuning.floorSweep.height) {
        this.onSweepContact?.(voltCheetahTuning.floorSweep.damage);
      }
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.invulnerable = true;
    this.bossFsmState = 'ritual';
    this.framesRemaining = 0;
    this.desperationQueued = null;
    this.sweepHazard.setVisible(false);
  }
}
