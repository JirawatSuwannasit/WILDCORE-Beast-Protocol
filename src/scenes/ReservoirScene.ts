import Phaser from 'phaser';
import { BaseStageScene, type EntitySpawner } from '@/scenes/BaseStageScene';
import { THEME } from '@/config/theme';
import reservoirMapData from '@/data/stages/reservoir.json';
import { getObjectLayer, getObjectProperty, type TiledMap } from '@/data/tiledTypes';
import { DartFish } from '@/actors/enemies/DartFish';
import { BubbleCrab } from '@/actors/enemies/BubbleCrab';
import { Anglerfish } from '@/actors/bosses/Anglerfish';
import { TideManta } from '@/actors/bosses/TideManta';
import { BossDoor } from '@/actors/BossDoor';
import { EnergyPickupStub } from '@/actors/EnergyPickupStub';
import { Current } from '@/actors/hazards/Current';
import { ToxicUrchin } from '@/actors/hazards/ToxicUrchin';
import { RisingWaterZone } from '@/actors/hazards/RisingWaterZone';
import { WaterValve } from '@/actors/WaterValve';
import { WaterGate } from '@/actors/WaterGate';
import { BodyCapsuleStub } from '@/actors/BodyCapsuleStub';
import { BodyCapsulePump } from '@/actors/BodyCapsulePump';
import { toxicUrchinTuning } from '@/config/enemyTuning';
import { TILE_SIZE } from '@/config/playerTuning';

const ARENA_MARGIN = 24;
const BOSS_DOOR_SEAL_MS = 600;
const WEAPON_GET_STUB_MS = 2600;
const MID_BOSS_ARENA_HALF_WIDTH = 160;

/** GDD §3.2/§3b/§4: Coral Reservoir - the M4.1 stage. */
export class ReservoirScene extends BaseStageScene {
  protected readonly mapKey = 'reservoir';
  protected readonly mapData = reservoirMapData as unknown as TiledMap;
  protected readonly tileColors = [THEME.panel, THEME.accentCoral] as const;

  private boss: TideManta | null = null;
  private bossDoor: BossDoor | null = null;
  private bossRoomEntered = false;
  private bossFloorY = 0;
  private stageComplete = false;

  private midBossArenaCenterX = 0;
  private midBossDarkOverlay: Phaser.GameObjects.Rectangle | null = null;
  private midBossTriggered = false;

  private readonly currents: Current[] = [];
  private readonly urchins: ToxicUrchin[] = [];
  private readonly valves: WaterValve[] = [];
  private readonly gates: WaterGate[] = [];
  private readonly gatesByName = new Map<string, WaterGate>();
  private readonly pendingValveLinks: { valve: WaterValve; targetGateName: string }[] = [];

  // GDD §2.7 problem 2 fix: the setpiece's rising-water moment. Triggered
  // once the player enters the ascent shaft's own vertical-camera zone
  // (reused as the trigger - no separate zone needed).
  private readonly risingWaterZones: RisingWaterZone[] = [];
  private ascentShaftZoneRef: Phaser.GameObjects.Zone | null = null;
  private risingWaterTriggered = false;

  protected readonly entityRegistry: Record<string, EntitySpawner> = {
    dartFish: (_scene, x, y) => {
      const fish = new DartFish(this, x, y);
      this.registerEnemy(fish, x, y);
    },

    bubbleCrab: (_scene, x, y) => {
      const crab = new BubbleCrab(this, x, y);
      this.registerEnemy(crab, x, y);
    },

    toxicUrchin: (_scene, x, y, object) => {
      const urchin = new ToxicUrchin(this, x, y, object.width, object.height);
      this.urchins.push(urchin);
      this.physics.add.overlap(this.player.hurtboxZone, urchin.hazardZone, () =>
        this.player.takeDamage(toxicUrchinTuning.contactDamage, x),
      );
    },

    current: (_scene, x, y, object) => {
      const pushX = getObjectProperty(object, 'pushX', 0);
      const pushY = getObjectProperty(object, 'pushY', 0);
      const current = new Current(this, x, y, object.width, object.height, pushX, pushY);
      this.currents.push(current);
    },

    waterGate: (_scene, x, y, object) => {
      const startsOpen = getObjectProperty(object, 'startsOpen', false);
      const gate = new WaterGate(this, object.name, x, y, object.width, object.height, startsOpen);
      this.gates.push(gate);
      this.gatesByName.set(object.name, gate);
      this.physics.add.collider(this.player, gate.collider);
    },

    waterValve: (_scene, x, y, object) => {
      const valve = new WaterValve(this, x, y);
      this.valves.push(valve);
      const targetGateName = getObjectProperty(object, 'targetGate', '');
      this.pendingValveLinks.push({ valve, targetGateName });
    },

    bodyCapsulePump: (_scene, x, y) => {
      const capsule = new BodyCapsuleStub(this, x - 20, y);
      this.physics.add.overlap(this.player.hurtboxZone, capsule.pickupZone, () =>
        capsule.collect(),
      );
      const pump = new BodyCapsulePump(this, x, y, capsule);
      this.physics.add.overlap([...this.player.weapons.hitboxes], pump, (hitboxObj) => {
        this.player.weapons.resolveUtilityHit(
          hitboxObj as unknown as import('@/actors/weapons/WeaponEffectSprite').WeaponEffectSprite,
          pump,
        );
      });
    },

    energyPickup: (_scene, x, y) => {
      const pickup = new EnergyPickupStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, pickup.pickupZone, () => pickup.collect());
    },

    anglerfishSpawn: (_scene, x, y) => {
      const anglerfish = new Anglerfish(this, x, y);
      anglerfish.onPlayerContact = (damage) => this.player.takeDamage(damage, anglerfish.x);
      anglerfish.onDefeated = () => this.midBossDefeated();
      this.midBossArenaCenterX = x;
      this.registerEnemy(anglerfish, x, y);
    },

    midBossRoomTrigger: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player.hurtboxZone, zone, () => this.onMidBossRoomEntered());
    },

    ascentShaftZone: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.registerVerticalCameraZone(zone);
      this.ascentShaftZoneRef = zone;
    },

    risingWaterZone: (_scene, x, _y, object) => {
      const bottomRow = getObjectProperty(object, 'bottomRow', 0);
      const ceilingRow = getObjectProperty(object, 'ceilingRow', 0);
      const zone = new RisingWaterZone(
        this,
        x,
        object.width,
        bottomRow * TILE_SIZE,
        ceilingRow * TILE_SIZE,
      );
      this.risingWaterZones.push(zone);
    },

    bossDoor: (_scene, x, _y, object) => {
      this.bossDoor = new BossDoor(this, x, object.y, object.width, object.height);
      this.physics.add.collider(this.player, this.bossDoor.collider);
    },

    bossSpawn: (_scene, x, y) => {
      const { left, right } = this.bossRoomBounds;
      this.bossFloorY = y;
      const boss = new TideManta(this, x, y, left, right, y - 64);
      boss.onPlayerContact = (damage) => this.player.takeDamage(damage, boss.x);
      boss.onEruptContact = (damage) => this.player.takeDamage(damage, boss.x);
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
    super('Reservoir');
  }

  create(): void {
    super.create();

    // Resolve valve->gate links now that every entity (regardless of file
    // order) has been spawned - see DECISIONS.md.
    for (const { valve, targetGateName } of this.pendingValveLinks) {
      const gate = this.gatesByName.get(targetGateName);
      if (gate) valve.linkGate(gate);
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
    this.updateWater();
  }

  private updateWater(): void {
    let submerged = false;
    let pushX = 0;
    let pushY = 0;

    for (const gate of this.gates) {
      if (gate.isOpen && this.physics.overlap(this.player.hurtboxZone, gate.submersionZone)) {
        submerged = true;
      }
    }
    for (const current of this.currents) {
      current.fixedUpdate();
      if (this.physics.overlap(this.player.hurtboxZone, current.zone)) {
        submerged = true;
        pushX += current.pushX;
        pushY += current.pushY;
      }
    }

    // GDD §2.7 problem 2: the setpiece's rising-water moment (see
    // RisingWaterZone) - folded into the same submerged/push accumulator
    // as gates/currents above so overlapping both at once combines
    // correctly instead of one silently overwriting the other.
    if (!this.risingWaterTriggered && this.ascentShaftZoneRef) {
      if (this.physics.overlap(this.player.hurtboxZone, this.ascentShaftZoneRef)) {
        this.risingWaterTriggered = true;
        for (const zone of this.risingWaterZones) zone.trigger();
      }
    }
    for (const zone of this.risingWaterZones) {
      zone.fixedUpdate();
      if (zone.overlaps(this.player.x, this.player.y)) {
        submerged = true;
        pushY += zone.pushY;
      }
    }

    this.player.setSubmerged(submerged);
    this.player.applyCurrentPush(pushX, pushY);

    for (const valve of this.valves) {
      valve.updateOverlap(this, this.physics.overlap(this.player.hurtboxZone, valve.zone));
    }
  }

  protected respawnPlayer(): void {
    super.respawnPlayer();
    if (this.bossRoomEntered && !this.stageComplete) {
      const { left } = this.bossRoomBounds;
      this.player.respawnAt(left + 16, this.bossFloorY);
    }
  }

  /** GDD §3.2: "Anglerfish lamp mimic in a dark tunnel" - a simple darkening overlay for the arena, no shutter door (mid-bosses don't get the boss-door ritual, same as Speedway's twin drones). */
  private onMidBossRoomEntered(): void {
    if (this.midBossTriggered) return;
    this.midBossTriggered = true;

    const overlay = this.add
      .rectangle(
        this.midBossArenaCenterX,
        this.bossFloorY || this.player.y,
        MID_BOSS_ARENA_HALF_WIDTH * 2,
        400,
        0x000000,
        0.45,
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
        'TIDE MANTA DEFEATED\n\nWEAPON GET: TIDE BURST\n(stub - a later milestone wires this into the weapon wheel)',
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
