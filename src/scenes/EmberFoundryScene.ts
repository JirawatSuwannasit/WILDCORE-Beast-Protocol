import Phaser from 'phaser';
import { BaseStageScene, type EntitySpawner } from '@/scenes/BaseStageScene';
import { THEME } from '@/config/theme';
import emberMapData from '@/data/stages/ember.json';
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
import { pistonCrusherTuning } from '@/config/emberTuning';

const ARENA_MARGIN = 24,
  BOSS_DOOR_SEAL_MS = 600,
  WEAPON_GET_STUB_MS = 2600;
export class EmberFoundryScene extends BaseStageScene {
  protected readonly mapKey = 'ember';
  protected readonly mapData = emberMapData as unknown as TiledMap;
  protected readonly tileColors = [THEME.accentCoral, THEME.accentAmber] as const;
  private boss: MagmaRhino | null = null;
  private bossDoor: BossDoor | null = null;
  private bossRoomEntered = false;
  private bossFloorY = 0;
  private stageComplete = false;
  private vents: HeatVent[] = [];
  private crushers: PistonCrusher[] = [];
  private lavas: RisingLavaZone[] = [];
  private lavaTriggered = false;
  protected readonly entityRegistry: Record<string, EntitySpawner> = {
    slagBlob: (_s, x, y) => this.registerEnemy(new SlagBlob(this, x, y), x, y),
    emberBat: (_s, x, y) => this.registerEnemy(new EmberBat(this, x, y), x, y),
    slagGolemSpawn: (_s, x, y) => {
      const g = new SlagGolem(this, x, y);
      this.registerEnemy(g, x, y);
    },
    heatVent: (_s, x, y, o) =>
      this.vents.push(
        new HeatVent(this, x, y, o.width, o.height, getObjectProperty(o, 'slowfall', false)),
      ),
    pistonCrusher: (_s, x, y, o) =>
      this.crushers.push(
        new PistonCrusher(this, x, y, o.width, o.height, getObjectProperty(o, 'phase', 0)),
      ),
    risingLavaZone: (_s, x, _y, o) =>
      this.lavas.push(
        new RisingLavaZone(
          this,
          x,
          o.width,
          getObjectProperty(o, 'bottomRow', 0) * 16,
          getObjectProperty(o, 'ceilingRow', 0) * 16,
        ),
      ),
    ascentShaftZone: (_s, x, y, o) => {
      const z = this.add.zone(x, y, o.width, o.height);
      this.physics.add.existing(z, true);
      this.registerVerticalCameraZone(z);
    },
    lavaChaseTrigger: (_s, x, y, o) => {
      const z = this.add.zone(x, y, o.width, o.height);
      this.physics.add.existing(z, true);
      this.registerVerticalCameraZone(z);
      this.physics.add.overlap(this.player.hurtboxZone, z, () => {
        if (!this.lavaTriggered) {
          this.lavaTriggered = true;
          this.lavas.forEach((l) => l.trigger());
        }
      });
    },
    energyPickup: (_s, x, y) => {
      const p = new EnergyPickupStub(this, x, y);
      this.physics.add.overlap(this.player.hurtboxZone, p.pickupZone, () => p.collect());
    },
    heartChip: (_s, x, y) => {
      const p = new HeartChipStub(this, x, y);
      this.add.text(x - 42, y - 22, '2-cycle crusher route', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: THEME.textCream,
      });
      this.physics.add.overlap(this.player.hurtboxZone, p.pickupZone, () => p.collect());
    },
    cellPack: (_s, x, y) => {
      const p = new CellPackStub(this, x, y);
      this.add.text(x - 48, y - 22, 'dash helps; base-kit wall-kick works', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: THEME.textCream,
      });
      this.physics.add.overlap(this.player.hurtboxZone, p.pickupZone, () => p.collect());
    },
    bossDoor: (_s, x, _y, o) => {
      this.bossDoor = new BossDoor(this, x, o.y, o.width, o.height);
      this.physics.add.collider(this.player, this.bossDoor.collider);
    },
    bossSpawn: (_s, x, y) => {
      const { left, right } = this.bossRoomBounds;
      this.bossFloorY = y;
      const b = new MagmaRhino(this, x, y, left, right);
      b.onPlayerContact = (d) => this.player.takeDamage(d, b.x);
      b.onDefeated = () => this.onBossDefeated();
      this.boss = b;
      this.registerEnemy(b, x, y);
    },
    bossRoomTrigger: (_s, x, y, o) => {
      const z = this.add.zone(x, y, o.width, o.height);
      this.physics.add.existing(z, true);
      this.physics.add.overlap(this.player.hurtboxZone, z, () => this.onBossRoomEntered());
    },
  };
  constructor() {
    super('EmberFoundry');
  }
  private get bossRoomBounds() {
    const s = getObjectLayer(this.mapData, 'sections').find((o) => o.name === 'bossRoom');
    return s
      ? { left: s.x + ARENA_MARGIN, right: s.x + s.width - ARENA_MARGIN }
      : { left: 0, right: this.map.widthInPixels };
  }
  protected fixedUpdate(): void {
    if (this.stageComplete) return;
    super.fixedUpdate();
    for (const v of this.vents) {
      v.fixedUpdate();
      if (this.physics.overlap(this.player.hurtboxZone, v.zone))
        v.apply(this.player as unknown as { body: Phaser.Physics.Arcade.Body });
    }
    for (const c of this.crushers) {
      c.fixedUpdate();
      if (c.isClosed && this.physics.overlap(this.player.hurtboxZone, c.hazardZone))
        this.player.takeDamage(pistonCrusherTuning.damage, c.hazardZone.x);
    }
    for (const l of this.lavas) {
      l.fixedUpdate();
      if (l.overlaps(this.player.x, this.player.y)) this.respawnPlayer();
    }
  }
  protected respawnPlayer(): void {
    super.respawnPlayer();
    if (this.bossRoomEntered && !this.stageComplete) {
      const { left } = this.bossRoomBounds;
      this.player.respawnAt(left + 16, this.bossFloorY);
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
    const o = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setScrollFactor(0)
      .setDepth(2000);
    const t = this.add
      .text(width / 2, height / 2, 'MAGMA RHINO FREED\n\nWEAPON GET: MAGMA CHARGE', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: THEME.textCream,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);
    this.time.delayedCall(WEAPON_GET_STUB_MS, () => {
      o.destroy();
      t.destroy();
      this.scene.start('StageSelect');
    });
  }
}
