import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { tideMantaTuning } from '@/config/bossTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { isWeakness, type WeaponId } from '@/data/weaknessWheel';

const SIZE = { width: 26, height: 14 };
const IDLE_FRAMES = 45;
const WEAKNESS_STUN_FRAMES = 30;
const ERUPT_RECOVER_FRAMES = 24;
const ORB_RECOVER_FRAMES = 20;

type PatternId = 'sineGlide' | 'burrowErupt' | 'orbRing';
type State =
  | 'ritual'
  | 'idle'
  | 'sineTelegraph'
  | 'sineGlide'
  | 'burrowDown'
  | 'burrowTravel'
  | 'shadowTelegraph'
  | 'erupt'
  | 'eruptFall'
  | 'eruptRecover'
  | 'orbTelegraph'
  | 'orbRecover'
  | 'stunned'
  | 'defeated';

/**
 * TIDE MANTA (GDD §3.2 / §4). 3 core patterns, all dodgeable with the
 * buster alone; weak to Volt Chain, which "electrifies the water it
 * swims in" - represented as a self-contained tint flash on the weakness
 * hit (see takesWeakness), not a separate gameplay hazard. Below 25% HP,
 * patterns chain back-to-back instead of pausing between them (same
 * desperation shape as VoltCheetah).
 */
export class TideManta extends Enemy {
  private bossFsmState: State = 'ritual';
  private framesRemaining = 0;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;
  private readonly floorY: number;
  private readonly swimTopY: number;
  private desperationQueued: PatternId | null = null;

  // Sine glide
  private glideStartX = 0;
  private glideEndX = 0;
  private glideElapsedFrames = 0;

  // Burrow + erupt
  private eruptX = 0;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  onPlayerContact: ((damage: number) => void) | null = null;
  onEruptContact: ((damage: number) => void) | null = null;
  onDefeated: (() => void) | null = null;
  onReaction: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    arenaLeft: number,
    arenaRight: number,
    arenaTop: number,
  ) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'tide-manta', SIZE.width, SIZE.height, THEME.accentTeal),
      tideMantaTuning.maxHp,
    );

    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.floorY = y;
    this.swimTopY = arenaTop;
    this.invulnerable = true; // during the fill ritual
    this.isMinor = false;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE.width, SIZE.height);
    body.setCollideWorldBounds(false);

    this.shadow = scene.add.ellipse(x, y, 20, 6, 0x000000, 0.5).setVisible(false);
  }

  get isInvulnerable(): boolean {
    return this.invulnerable;
  }

  get bossState(): State {
    return this.bossFsmState;
  }

  beginRitual(): void {
    this.bossFsmState = 'ritual';
    this.framesRemaining = Math.round(tideMantaTuning.fillRitualMs / (1000 / 60));
  }

  /** GDD §5: weak to Volt Chain - 4 damage + interrupt + reaction, regardless of current pattern. */
  takesWeakness(_weaponId: WeaponId): void {
    // `invulnerable` covers both the fill ritual and "hidden underground"
    // mid-burrow (GDD §3.2's burrow/erupt pattern) - neither should be
    // interruptible by a hit that can't actually connect.
    if (this.isDead || this.invulnerable || this.bossFsmState === 'defeated') return;
    this.takeDamage(tideMantaTuning.weaknessDamage);
    if (this.isDead) return;
    this.onReaction?.();
    this.flashElectrified();
    this.enterState('stunned', WEAKNESS_STUN_FRAMES);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    this.shadow.setVisible(false);
  }

  applyWeaponHit(weaponId: WeaponId, damage: number): void {
    if (isWeakness(weaponId, 'tideManta')) {
      this.takesWeakness(weaponId);
    } else {
      this.takeDamage(damage);
    }
  }

  /** "Electrifies the water it swims in" (GDD §3.2) - a self-contained visual sell for the weakness hit. */
  private flashElectrified(): void {
    this.visual.setTintFill(THEME.accentAmber);
    this.scene.time.delayedCall(180, () => this.visual.clearTint());
  }

  protected onDeath(): void {
    super.onDeath();
    this.bossFsmState = 'defeated';
    this.shadow.setVisible(false);
    this.onDefeated?.();
  }

  fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void {
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

      case 'sineTelegraph':
        if (this.framesRemaining <= 0) this.launchSineGlide();
        break;

      case 'sineGlide':
        this.updateSineGlide();
        break;

      case 'burrowDown':
        if (this.framesRemaining <= 0) this.startBurrowTravel(playerX);
        break;

      case 'burrowTravel':
        if (this.framesRemaining <= 0) this.startShadowTelegraph(playerX);
        break;

      case 'shadowTelegraph':
        if (this.framesRemaining <= 0) this.launchErupt();
        break;

      case 'erupt':
        this.updateErupt();
        break;

      case 'eruptFall':
        this.updateEruptFall();
        break;

      case 'orbTelegraph':
        if (this.framesRemaining <= 0) this.fireOrbRing(bolts);
        break;

      case 'eruptRecover':
      case 'orbRecover':
      case 'stunned':
        if (this.framesRemaining <= 0) this.finishPattern();
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
    const order: PatternId[] = ['sineGlide', 'burrowErupt', 'orbRing'];
    return order[Phaser.Math.Between(0, order.length - 1)] ?? 'sineGlide';
  }

  private startPattern(pattern: PatternId, playerX: number, _playerY: number): void {
    void playerX;
    if (pattern === 'sineGlide') {
      this.enterState('sineTelegraph', tideMantaTuning.sineGlide.telegraphFrames);
    } else if (pattern === 'burrowErupt') {
      this.enterState('burrowDown', tideMantaTuning.burrowErupt.burrowFrames);
      this.visual.setAlpha(0.3);
      this.invulnerable = true; // hidden underground - nothing to hit until it erupts
    } else {
      this.enterState('orbTelegraph', tideMantaTuning.orbRing.telegraphFrames);
    }
  }

  // --- Pattern (a): sine-wave glide ---------------------------------------

  private launchSineGlide(): void {
    const center = this.bodyCenter;
    const margin = SIZE.width;
    const goingRight = center.x <= (this.arenaLeft + this.arenaRight) / 2;
    this.glideStartX = center.x;
    this.glideEndX = goingRight ? this.arenaRight - margin : this.arenaLeft + margin;
    this.glideElapsedFrames = 0;
    this.enterState('sineGlide', tideMantaTuning.sineGlide.durationFrames);
  }

  private updateSineGlide(): void {
    const { durationFrames, amplitudeY, periodFrames } = tideMantaTuning.sineGlide;
    this.glideElapsedFrames += 1;
    const t = Phaser.Math.Clamp(this.glideElapsedFrames / durationFrames, 0, 1);
    const x = Phaser.Math.Linear(this.glideStartX, this.glideEndX, t);
    const baseY = (this.swimTopY + this.floorY) / 2;
    const y = baseY + Math.sin((this.glideElapsedFrames / periodFrames) * Math.PI * 2) * amplitudeY;
    (this.body as Phaser.Physics.Arcade.Body).reset(x, y);

    if (this.framesRemaining <= 0) this.finishPattern();
  }

  // --- Pattern (b): burrow into the water floor, erupt below the player ---

  private startBurrowTravel(_playerX: number): void {
    this.visual.setAlpha(0.15);
    (this.body as Phaser.Physics.Arcade.Body).reset(this.bodyCenter.x, this.floorY + 10);
    this.enterState('burrowTravel', tideMantaTuning.burrowErupt.travelFrames);
  }

  private startShadowTelegraph(playerX: number): void {
    this.eruptX = Phaser.Math.Clamp(
      playerX,
      this.arenaLeft + SIZE.width,
      this.arenaRight - SIZE.width,
    );
    this.shadow.setPosition(this.eruptX, this.floorY);
    this.shadow.setVisible(true);
    this.enterState('shadowTelegraph', tideMantaTuning.burrowErupt.shadowTelegraphFrames);
  }

  private launchErupt(): void {
    this.shadow.setVisible(false);
    this.visual.setAlpha(1);
    this.invulnerable = false; // vulnerable again from the moment it erupts into view
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(this.eruptX, this.floorY + 4);
    body.setAllowGravity(true);
    body.setGravityY(tideMantaTuning.burrowErupt.gravity);
    body.setVelocityY(tideMantaTuning.burrowErupt.eruptVelocityY);
    this.bossFsmState = 'erupt';
  }

  private updateErupt(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y >= 0) this.bossFsmState = 'eruptFall';
  }

  private updateEruptFall(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.center.y >= this.floorY) {
      body.reset(body.center.x, this.floorY);
      body.setAllowGravity(false);
      body.setVelocity(0, 0);
      this.enterState('eruptRecover', ERUPT_RECOVER_FRAMES);
    }
  }

  // --- Pattern (c): ring of water orbs -------------------------------------

  private fireOrbRing(bolts: EnemyProjectilePool): void {
    const center = this.bodyCenter;
    const { orbCount, orbSpeed, orbDamage } = tideMantaTuning.orbRing;
    for (let i = 0; i < orbCount; i += 1) {
      const angle = (i / orbCount) * Math.PI * 2;
      bolts.fire(
        center.x,
        center.y,
        Math.cos(angle) * orbSpeed,
        Math.sin(angle) * orbSpeed,
        orbDamage,
      );
    }
    this.enterState('orbRecover', ORB_RECOVER_FRAMES);
  }

  // --- Shared -----------------------------------------------------------

  private finishPattern(): void {
    if (this.hpFraction() < tideMantaTuning.desperationHpFraction && !this.desperationQueued) {
      this.desperationQueued = this.pickPattern();
      this.enterState('eruptRecover', tideMantaTuning.desperation.linkFrames);
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
    return this.hitPoints / tideMantaTuning.maxHp;
  }

  private checkContactDamage(playerX: number, playerY: number): void {
    if (this.bossFsmState === 'ritual' || this.bossFsmState === 'defeated') return;
    if (this.bossFsmState === 'burrowDown' || this.bossFsmState === 'burrowTravel') return; // hidden underground - untouchable, unhittable

    const center = this.bodyCenter;
    const dx = Math.abs(playerX - center.x);
    const dy = Math.abs(playerY - center.y);
    if (dx < SIZE.width / 2 + 6 && dy < SIZE.height / 2 + 6) {
      if (this.bossFsmState === 'erupt' || this.bossFsmState === 'eruptFall') {
        this.onEruptContact?.(tideMantaTuning.burrowErupt.damage);
      } else {
        this.onPlayerContact?.(tideMantaTuning.contactDamage);
      }
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.invulnerable = true;
    this.bossFsmState = 'ritual';
    this.framesRemaining = 0;
    this.desperationQueued = null;
    this.shadow.setVisible(false);
    this.visual.setAlpha(1);
    this.visual.clearTint();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
  }
}
