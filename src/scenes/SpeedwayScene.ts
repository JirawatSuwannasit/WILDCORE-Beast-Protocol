import Phaser from 'phaser';
import { BaseStageScene, type EntitySpawner } from '@/scenes/BaseStageScene';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import speedwayMapData from '@/data/stages/speedway.json';
import { getObjectLayer, getObjectProperty, objectCenter, type TiledMap } from '@/data/tiledTypes';
import { PatrolDrone } from '@/actors/enemies/PatrolDrone';
import { SparkBug } from '@/actors/enemies/SparkBug';
import { TurretSunflower } from '@/actors/enemies/TurretSunflower';
import { VoltCheetah } from '@/actors/bosses/VoltCheetah';
import { BossDoor } from '@/actors/BossDoor';
import { LegsCapsuleStub } from '@/actors/LegsCapsuleStub';
import { EnergyPickupStub } from '@/actors/EnergyPickupStub';

const ARENA_MARGIN = 24;
// The route-shape rebuild ends the main path one "screen" (12 tiles) below
// the stage's starting baseline (a net descent overall - see DECISIONS.md
// for the full elevation walk), so this is no longer the same Y as the
// player's spawn point the way it was pre-route-shape; it matches the
// generated map's own bossSpawn object-center Y directly.
const BOSS_ROOM_FLOOR_Y = 888;
// The boss room is much taller than the 180px-tall native viewport, so the
// locked boss camera must center on the ground band, not the map's overall
// vertical midpoint - the latter would frame mostly empty air above the fight.
const BOSS_ROOM_CAMERA_Y = BOSS_ROOM_FLOOR_Y - 20;
// Must be >= BossDoor's own close-tween duration so the ritual never
// starts while the shutter is still visibly sliding down.
const BOSS_DOOR_SEAL_MS = 600;
const WEAPON_GET_STUB_MS = 2600;

/** GDD §3.1/§3b/§4: Speedway Savanna - the M2 stage. */
export class SpeedwayScene extends BaseStageScene {
  protected readonly mapKey = 'speedway';
  protected readonly mapData = speedwayMapData as unknown as TiledMap;
  protected readonly tileColors = [THEME.panel, THEME.accentTeal] as const;

  private boss: VoltCheetah | null = null;
  private bossDoor: BossDoor | null = null;
  private bossRoomEntered = false;
  private stageComplete = false;

  protected readonly entityRegistry: Record<string, EntitySpawner> = {
    sparkBug: (_scene, x, y) => {
      const bug = new SparkBug(this, x, y);
      this.registerEnemy(bug, x, y);
    },

    patrolDrone: (_scene, x, y, object) => {
      const orbitPylon = getObjectProperty(object, 'orbitPylon', false);
      if (orbitPylon) {
        const pylonObject = getObjectLayer(this.mapData, 'entities').find(
          (o) => o.type === 'pylon',
        );
        const center = pylonObject ? objectCenter(pylonObject) : { x, y };
        const angleOffsetDeg = getObjectProperty(object, 'orbitAngleOffsetDeg', 0);
        const drone = new PatrolDrone(this, x, y, {
          orbit: {
            centerX: center.x,
            centerY: center.y,
            angleOffsetRad: Phaser.Math.DegToRad(angleOffsetDeg),
          },
        });
        this.registerEnemy(drone, x, y);
      } else {
        const patrolRangeX = getObjectProperty(object, 'patrolRangeX', 0);
        const drone = new PatrolDrone(this, x, y, patrolRangeX > 0 ? { patrolRangeX } : {});
        this.registerEnemy(drone, x, y);
      }
    },

    turretSunflower: (_scene, x, y) => {
      const turret = new TurretSunflower(this, x, y);
      this.registerEnemy(turret, x, y);
    },

    pylon: (_scene, x, y, object) => {
      const texture = getRectTexture(
        this,
        `pylon-${object.width}x${object.height}`,
        object.width,
        object.height,
        THEME.moss,
      );
      const pillar = this.physics.add.staticImage(x, y, texture);
      this.physics.add.collider(this.player, pillar);
    },

    legsCapsule: (_scene, x, y) => {
      const capsule = new LegsCapsuleStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, capsule.pickupZone, () =>
        capsule.collect(),
      );
    },

    energyPickup: (_scene, x, y) => {
      const pickup = new EnergyPickupStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, pickup.pickupZone, () => pickup.collect());
    },

    bossDoor: (_scene, x, _y, object) => {
      this.bossDoor = new BossDoor(this, x, object.y, object.width, object.height);
      this.physics.add.collider(this.player, this.bossDoor.collider);
    },

    bossSpawn: (_scene, x, y) => {
      const { left, right } = this.bossRoomBounds;
      const boss = new VoltCheetah(this, x, y, left, right);
      boss.onPlayerContact = (damage) => this.player.takeDamage(damage, boss.x);
      boss.onSweepContact = (damage) => this.player.takeDamage(damage, boss.x);
      boss.onDefeated = () => this.onBossDefeated();
      this.boss = boss;
      this.registerEnemy(boss, x, y);
    },

    bossRoomTrigger: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.player.hurtboxZone, zone, () => this.onBossRoomEntered());
    },

    ascentShaftZone: (_scene, x, y, object) => {
      const zone = this.add.zone(x, y, object.width, object.height);
      this.physics.add.existing(zone, true);
      this.registerVerticalCameraZone(zone);
    },
  };

  constructor() {
    super('Speedway');
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
  }

  /** Boss-room-only respawn override (GDD ambiguity - see DECISIONS.md M2): dying mid-fight
   * behind the sealed shutter must not strand the player outside a door that never reopens. */
  protected respawnPlayer(): void {
    super.respawnPlayer();
    if (this.bossRoomEntered && !this.stageComplete) {
      const { left } = this.bossRoomBounds;
      this.player.respawnAt(left + 16, BOSS_ROOM_FLOOR_Y);
    }
  }

  private onBossRoomEntered(): void {
    if (this.bossRoomEntered) return;
    this.bossRoomEntered = true;

    const { left, right } = this.bossRoomBounds;
    this.lockCameraOn((left + right) / 2, BOSS_ROOM_CAMERA_Y);
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
        'VOLT CHEETAH DEFEATED\n\nWEAPON GET: VOLT WHIP\n(stub - a later milestone wires this into the weapon wheel)',
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
