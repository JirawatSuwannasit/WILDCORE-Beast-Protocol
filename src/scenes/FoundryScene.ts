import { BaseStageScene, type EntitySpawner } from '@/scenes/BaseStageScene';
import { THEME } from '@/config/theme';
import foundryMapData from '@/data/stages/foundry.json';
import { getObjectLayer, getObjectProperty, type TiledMap } from '@/data/tiledTypes';
import { SlagBlob } from '@/actors/enemies/SlagBlob';
import { EmberBat } from '@/actors/enemies/EmberBat';
import { SlagGolem } from '@/actors/bosses/SlagGolem';
import { MagmaRhino } from '@/actors/bosses/MagmaRhino';
import { BossDoor } from '@/actors/BossDoor';
import { EnergyPickupStub } from '@/actors/EnergyPickupStub';
import { HeartChipStub } from '@/actors/HeartChipStub';
import { CellPackStub } from '@/actors/CellPackStub';
import { HeatVent } from '@/actors/hazards/HeatVent';
import { PistonCrusher } from '@/actors/hazards/PistonCrusher';
import { RisingLavaZone } from '@/actors/hazards/RisingLavaZone';
import { SlagFlamePool } from '@/actors/hazards/SlagFlame';
import { slagFlameTuning } from '@/config/enemyTuning';
import { applyLavafallSlowfall } from '@/systems/foundryMechanics';
import { TILE_SIZE } from '@/config/playerTuning';

const ARENA_MARGIN = 24;
const BOSS_DOOR_SEAL_MS = 600;
const WEAPON_GET_STUB_MS = 2600;

/** GDD §3.3/§3b/§4: Ember Foundry - the M4.2 stage. */
export class FoundryScene extends BaseStageScene {
  protected readonly mapKey = 'foundry';
  protected readonly mapData = foundryMapData as unknown as TiledMap;
  protected readonly tileColors = [THEME.panel, THEME.accentCoral] as const;

  private boss: MagmaRhino | null = null;
  private bossDoor: BossDoor | null = null;
  private bossRoomEntered = false;
  private bossFloorY = 0;
  private stageComplete = false;

  private midBossArenaCenterX = 0;
  private midBossDarkOverlay: Phaser.GameObjects.Rectangle | null = null;
  private midBossTriggered = false;

  private readonly heatVents: HeatVent[] = [];
  private readonly crushers: PistonCrusher[] = [];
  private readonly lavaZones: RisingLavaZone[] = [];
  private readonly controlledDescentZones: Array<{
    zone: Phaser.GameObjects.Zone;
    maxFallSpeedY: number;
  }> = [];
  private slagFlames!: SlagFlamePool;

  private lavaChaseTriggerZoneRef: Phaser.GameObjects.Zone | null = null;
  private lavaChaseTriggered = false;

  protected readonly entityRegistry: Record<string, EntitySpawner> = {
    slagBlob: (_scene, x, y) => {
      const blob = new SlagBlob(this, x, y);
      blob.onSpawnFlame = (fx, fy) => this.slagFlames.spawn(fx, fy);
      this.registerEnemy(blob, x, y);
    },

    emberBat: (_scene, x, y) => {
      const bat = new EmberBat(this, x, y);
      this.registerEnemy(bat, x, y);
    },

    heatVent: (_scene, x, y, object) => {
      const pushX = getObjectProperty(object, 'pushX', 0);
      const pushY = getObjectProperty(object, 'pushY', -160);
      const vent = new HeatVent(this, x, y, object.width, object.height, pushX, pushY);
      this.heatVents.push(vent);
    },

    pistonCrusher: (_scene, x, y, object) => {
      const headWidth = getObjectProperty(object, 'headWidth', 8);
      const headHeight = getObjectProperty(object, 'headHeight', 48);
      const travelWidth = getObjectProperty(object, 'travelWidth', 32);
      const extendToward = getObjectProperty(object, 'extendToward', 1) as 1 | -1;
      const crusher = new PistonCrusher(
        this,
        x,
        y,
        travelWidth,
        headWidth,
        headHeight,
        extendToward,
      );
      this.crushers.push(crusher);
      this.physics.add.overlap(this.player.hurtboxZone, crusher.hazardZone, () =>
        this.onCrusherOverlap(crusher),
      );
    },

    risingLavaZone: (_scene, x, _y, object) => {
      const bottomRow = getObjectProperty(object, 'bottomRow', 0);
      const ceilingRow = getObjectProperty(object, 'ceilingRow', 0);
      const zone = new RisingLavaZone(
        this,
        x,
        object.width,
        bottomRow * TILE_SIZE,
        ceilingRow * TILE_SIZE,
      );
      this.lavaZones.push(zone);
    },

    lavaChaseTriggerZone: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.lavaChaseTriggerZoneRef = zone;
    },

    controlledDescentZone: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.controlledDescentZones.push({
        zone,
        maxFallSpeedY: getObjectProperty(object, 'maxFallSpeedY', 130),
      });
    },

    ascentShaftZone: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.registerVerticalCameraZone(zone);
    },

    heartChip: (_scene, x, y) => {
      const chip = new HeartChipStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, chip.pickupZone, () => chip.collect());
    },

    cellPack: (_scene, x, y) => {
      const pack = new CellPackStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, pack.pickupZone, () => pack.collect());
    },

    energyPickup: (_scene, x, y) => {
      const pickup = new EnergyPickupStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, pickup.pickupZone, () => pickup.collect());
    },

    slagGolemSpawn: (_scene, x, y) => {
      const golem = new SlagGolem(this, x, y);
      golem.onPlayerContact = (damage) => this.player.takeDamage(damage, golem.x);
      golem.onSlamContact = (damage) => this.player.takeDamage(damage, golem.x);
      golem.onDefeated = () => this.midBossDefeated();
      this.midBossArenaCenterX = x;
      this.registerEnemy(golem, x, y);
    },

    midBossRoomTrigger: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player.hurtboxZone, zone, () => this.onMidBossRoomEntered());
    },

    bossDoor: (_scene, x, _y, object) => {
      this.bossDoor = new BossDoor(this, x, object.y, object.width, object.height);
      this.physics.add.collider(this.player, this.bossDoor.collider);
    },

    bossSpawn: (_scene, x, y) => {
      const { left, right } = this.bossRoomBounds;
      this.bossFloorY = y;
      const boss = new MagmaRhino(this, x, y, left, right);
      boss.onPlayerContact = (damage) => this.player.takeDamage(damage, boss.x);
      boss.onGeyserContact = (damage) => this.player.takeDamage(damage, boss.x);
      boss.onDefeated = () => this.onBossDefeated();
      this.boss = boss;
      this.registerEnemy(boss, x, y);
    },

    bossRoomTrigger: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player.hurtboxZone, zone, () => this.onBossRoomEntered());
    },
  };

  constructor() {
    super('Foundry');
  }

  create(): void {
    super.create();

    this.slagFlames = new SlagFlamePool(this);
    for (const flame of this.slagFlames.flames) {
      this.physics.add.overlap(this.player.hurtboxZone, flame, () => this.onSlagFlameOverlap());
    }
  }

  private get bossRoomBounds(): { left: number; right: number } {
    const section = getObjectLayer(this.mapData, 'sections').find((o) => o.name === 'bossRoom');
    if (!section) return { left: 0, right: this.map.widthInPixels };
    return {
      left: section.x + ARENA_MARGIN,
      right: section.x + section.width - ARENA_MARGIN,
    };
  }

  protected fixedUpdate(): void {
    if (this.stageComplete) return;
    super.fixedUpdate();
    this.updateFoundryHazards();
  }

  private updateFoundryHazards(): void {
    let pushX = 0;
    let pushY = 0;
    let pushed = false;

    for (const vent of this.heatVents) {
      vent.fixedUpdate();
      if (this.physics.overlap(this.player.hurtboxZone, vent.zone)) {
        pushed = true;
        pushX += vent.pushX;
        pushY += vent.pushY;
      }
    }
    if (pushed) this.player.applyCurrentPush(pushX, pushY);
    else this.player.applyCurrentPush(0, 0);

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (playerBody) {
      for (const descent of this.controlledDescentZones) {
        if (this.physics.overlap(this.player.hurtboxZone, descent.zone)) {
          playerBody.setVelocityY(
            applyLavafallSlowfall(playerBody.velocity.y, descent.maxFallSpeedY),
          );
        }
      }
    }

    for (const crusher of this.crushers) crusher.fixedUpdate();

    // GDD §3.3 setpiece: the rising lava chase triggers once the player
    // enters its trigger zone (same "enter once, arm every zone" idiom as
    // Reservoir's ascent-shaft-triggered rising water).
    if (!this.lavaChaseTriggered && this.lavaChaseTriggerZoneRef) {
      if (this.physics.overlap(this.player.hurtboxZone, this.lavaChaseTriggerZoneRef)) {
        this.lavaChaseTriggered = true;
        for (const zone of this.lavaZones) zone.trigger();
      }
    }
    for (const zone of this.lavaZones) {
      zone.fixedUpdate();
      if (zone.overlaps(this.player.x, this.player.y)) this.player.instaKill();
    }

    this.slagFlames.fixedUpdate();
  }

  private onCrusherOverlap(crusher: PistonCrusher): void {
    if (crusher.isLethal) this.player.instaKill();
  }

  private onSlagFlameOverlap(): void {
    this.player.takeDamage(slagFlameTuning.contactDamage, this.player.x);
  }

  protected respawnPlayer(): void {
    super.respawnPlayer();
    if (this.bossRoomEntered && !this.stageComplete) {
      const { left } = this.bossRoomBounds;
      this.player.respawnAt(left + 16, this.bossFloorY);
    }
  }

  /** GDD §3.3: "slag golem that re-forms once" - a real mid-boss fight, no shutter door/ritual (same treatment as Reservoir's Anglerfish). */
  private onMidBossRoomEntered(): void {
    if (this.midBossTriggered) return;
    this.midBossTriggered = true;

    const overlay = this.add
      .rectangle(
        this.midBossArenaCenterX,
        this.bossFloorY || this.player.y,
        320,
        400,
        0x000000,
        0.35,
      )
      .setDepth(500);
    this.midBossDarkOverlay = overlay;
  }

  private midBossDefeated(): void {
    if (this.midBossDarkOverlay) {
      this.tweens.add({
        targets: this.midBossDarkOverlay,
        alpha: 0,
        duration: 500,
        onComplete: () => this.midBossDarkOverlay?.destroy(),
      });
      this.midBossDarkOverlay = null;
    }
  }

  private onBossRoomEntered(): void {
    if (this.bossRoomEntered) return;
    this.bossRoomEntered = true;

    const { left, right } = this.bossRoomBounds;
    this.lockCameraOn((left + right) / 2, this.bossFloorY - 20);
    this.bossDoor?.close(this);
    this.time.delayedCall(BOSS_DOOR_SEAL_MS, () => this.boss?.beginRitual());
  }

  private onBossDefeated(): void {
    this.stageComplete = true;
    this.time.delayedCall(600, () => this.showWeaponGetStub());
  }

  private showWeaponGetStub(): void {
    const { width, height } = this.scale;
    const overlay = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setScrollFactor(0)
      .setDepth(2000);
    const text = this.add
      .text(
        width / 2,
        height / 2,
        'MAGMA RHINO DEFEATED\n\nWEAPON GET: MAGMA CHARGE\n(stub - a later milestone wires this into the weapon wheel)',
        { fontFamily: 'monospace', fontSize: '10px', color: THEME.textCream, align: 'center' },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.time.delayedCall(WEAPON_GET_STUB_MS, () => {
      overlay.destroy();
      text.destroy();
      this.scene.start('StageSelect');
    });
  }
}
