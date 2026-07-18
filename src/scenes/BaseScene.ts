import Phaser from 'phaser';
import { FixedTimestepAccumulator } from '@/systems/fixedTimestep';
import { GAME_WIDTH } from '@/config/resolution';
import { THEME } from '@/config/theme';

const PAUSE_UI_DEPTH = 1000;
const PAUSE_BUTTON_MARGIN = 8;

/**
 * Base class for every WILDCORE scene. Phaser calls `update(time, delta)`
 * once per render frame at a variable rate; this replays `fixedUpdate` at a
 * true 60Hz and exposes `renderAlpha` (0..1) so a scene can interpolate
 * sprite transforms between the previous and current fixed step instead of
 * visibly snapping (GDD §11.1: fixed 60Hz logic, render interpolation).
 *
 * Also provides a manual pause toggle (tap the corner button), distinct
 * from the app-background auto-pause in src/systems/lifecycle.ts: manual
 * pause only freezes `fixedUpdate` simulation, it does NOT call
 * `game.pause()`. A full engine pause halts Phaser's own input dispatch
 * too, which would make the pause button itself untappable and deadlock
 * the toggle - fine for backgrounding (nothing is visible to tap anyway)
 * but wrong for an in-scene pause the player needs to resume from.
 */
export abstract class BaseScene extends Phaser.Scene {
  private readonly accumulator = new FixedTimestepAccumulator();
  private manuallyPaused = false;
  private pausedBanner?: Phaser.GameObjects.Text;

  /** Interpolation factor for the render frame currently being drawn. */
  protected renderAlpha = 0;

  /**
   * Horizontal bounds of the 320px gameplay-critical safe zone, centered
   * in the current (device-aspect-dependent) world width. Backgrounds
   * may extend past this; hazards/UI that must be reachable/readable on
   * every device should not (GDD §0).
   */
  protected get safeZoneX(): { left: number; centerX: number; right: number } {
    const centerX = this.scale.width / 2;
    return { left: centerX - GAME_WIDTH / 2, centerX, right: centerX + GAME_WIDTH / 2 };
  }

  protected get isManuallyPaused(): boolean {
    return this.manuallyPaused;
  }

  init(): void {
    this.manuallyPaused = false;
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.createPauseControls());
  }

  update(time: number, delta: number): void {
    if (this.manuallyPaused) return;
    this.renderAlpha = this.accumulator.step(delta, (fixedDtMs) => {
      this.fixedUpdate(fixedDtMs, time);
    });
  }

  /** Override in subclasses that need deterministic 60Hz simulation. */
  protected fixedUpdate(_fixedDtMs: number, _time: number): void {
    // no-op by default; scene stubs have nothing to simulate yet.
  }

  shutdown(): void {
    this.accumulator.reset();
  }

  private createPauseControls(): void {
    const { right } = this.safeZoneX;

    this.add
      .text(right - PAUSE_BUTTON_MARGIN, PAUSE_BUTTON_MARGIN, '||', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: THEME.textCream,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(PAUSE_UI_DEPTH)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePause());

    this.pausedBanner = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'PAUSED\n(tap || to resume)', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: THEME.textCream,
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(PAUSE_UI_DEPTH)
      .setVisible(false);
  }

  private togglePause(): void {
    this.manuallyPaused = !this.manuallyPaused;
    this.pausedBanner?.setVisible(this.manuallyPaused);

    if (this.manuallyPaused) {
      this.tweens.pauseAll();
      this.sound.pauseAll();
    } else {
      this.tweens.resumeAll();
      this.sound.resumeAll();
    }
  }
}
