import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { pistonCrusherTuning } from '@/config/enemyTuning';

type Phase = 'open' | 'telegraph' | 'extended';

/**
 * GDD §3.3/§3b: "piston crushers on visible rails (2-cycle rhythm, >=30f
 * open window)." A crusher head slides along a visible rail between a
 * retracted (tucked into its housing, always safe) and an extended
 * (blocking the corridor, lethal) position: OPEN (safe, >=30f window,
 * tuned well above the floor) -> TELEGRAPH (>=20f wind-up, feel pillar #4)
 * -> EXTENDED (lethal, blocking) -> back to OPEN. The hazard zone stays
 * fixed at the extended footprint the whole time - only `isLethal` (gated
 * to the EXTENDED phase) decides whether an overlap there actually kills,
 * so retracting is conservatively treated as already-safe rather than
 * syncing a zone to the tween every frame.
 */
export class PistonCrusher {
  readonly hazardZone: Phaser.GameObjects.Zone;

  private phase: Phase = 'open';
  private framesRemaining: number = pistonCrusherTuning.openFrames;
  private flashFrame = 0;
  private readonly head: Phaser.GameObjects.Rectangle;
  private readonly retractedX: number;
  private readonly extendedX: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    travelWidth: number,
    headWidth: number,
    headHeight: number,
    extendToward: 1 | -1,
  ) {
    this.retractedX = x;
    this.extendedX = x + extendToward * travelWidth;

    const railLength = travelWidth + headWidth;
    const railCenterX = x + (extendToward * travelWidth) / 2;
    scene.add.rectangle(railCenterX, y, railLength, 3, THEME.panel).setStrokeStyle(1, 0x7a6c86);

    this.head = scene.add
      .rectangle(this.retractedX, y, headWidth, headHeight, THEME.accentCoral)
      .setStrokeStyle(1, THEME.textCreamHex);

    this.hazardZone = scene.add.zone(this.extendedX, y, headWidth, headHeight);
    scene.physics.add.existing(this.hazardZone, true);
  }

  get isLethal(): boolean {
    return this.phase === 'extended';
  }

  fixedUpdate(): void {
    this.flashFrame += 1;
    this.framesRemaining -= 1;

    if (this.framesRemaining <= 0) {
      switch (this.phase) {
        case 'open':
          this.phase = 'telegraph';
          this.framesRemaining = pistonCrusherTuning.telegraphFrames;
          break;
        case 'telegraph':
          this.phase = 'extended';
          this.framesRemaining = pistonCrusherTuning.extendedFrames;
          this.scene.tweens.add({
            targets: this.head,
            x: this.extendedX,
            duration: pistonCrusherTuning.travelMs,
            ease: 'Cubic.easeIn',
          });
          this.head.setFillStyle(THEME.accentCoral);
          break;
        case 'extended':
          this.phase = 'open';
          this.framesRemaining = pistonCrusherTuning.openFrames;
          this.head.setFillStyle(THEME.panel);
          this.scene.tweens.add({
            targets: this.head,
            x: this.retractedX,
            duration: pistonCrusherTuning.travelMs,
            ease: 'Cubic.easeOut',
          });
          break;
      }
    }

    // >=20f telegraph rumble - alternating flash, feel pillar #4.
    if (this.phase === 'telegraph') {
      this.head.setFillStyle(this.flashFrame % 6 < 3 ? THEME.accentCoral : THEME.accentAmber);
    }
  }
}
