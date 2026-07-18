import Phaser from 'phaser';
import { touchLayout } from '@/config/touchLayout';
import { dpToLogicalPx } from '@/systems/touchScale';
import { THEME } from '@/config/theme';

export interface TouchZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Floating virtual stick (GDD §2.2b): appears wherever the thumb first
 * touches down inside the left zone, rather than a fixed screen
 * position, then reports left/right based on drag distance from that
 * anchor. Horizontal-only - this is a 2D platformer, there's no
 * up/down movement axis to expose.
 */
export class FloatingStick {
  private activePointer: Phaser.Input.Pointer | null = null;
  private anchorX = 0;
  private anchorY = 0;

  private readonly base: Phaser.GameObjects.Arc;
  private readonly nub: Phaser.GameObjects.Arc;
  private readonly maxDragRadius: number;
  private readonly deadZone: number;

  constructor(scene: Phaser.Scene, zone: TouchZoneBounds) {
    this.maxDragRadius = dpToLogicalPx(scene, touchLayout.floatingStick.maxDragRadiusDp);
    this.deadZone = dpToLogicalPx(scene, touchLayout.floatingStick.deadZoneDp);
    const baseRadius = dpToLogicalPx(scene, touchLayout.floatingStick.baseDiameterDp) / 2;
    const nubRadius = dpToLogicalPx(scene, touchLayout.floatingStick.nubDiameterDp) / 2;

    this.base = scene.add
      .circle(0, 0, baseRadius, THEME.panel, touchLayout.opacity)
      .setScrollFactor(0)
      .setDepth(900)
      .setVisible(false);
    this.nub = scene.add
      .circle(0, 0, nubRadius, THEME.accentTeal, touchLayout.opacity)
      .setScrollFactor(0)
      .setDepth(901)
      .setVisible(false);

    const hitZone = scene.add
      .zone(zone.x, zone.y, zone.width, zone.height)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive();

    hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer !== null) return;
      this.activePointer = pointer;
      this.anchorX = pointer.x;
      this.anchorY = pointer.y;
      this.base.setPosition(this.anchorX, this.anchorY).setVisible(true);
      this.nub.setPosition(this.anchorX, this.anchorY).setVisible(true);
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.activePointer?.id !== pointer.id) return;
      this.activePointer = null;
      this.base.setVisible(false);
      this.nub.setVisible(false);
    });
  }

  /** Call once per render frame (or fixed step) to update the nub visual. */
  refreshVisual(): void {
    if (!this.activePointer) return;

    const dx = this.activePointer.x - this.anchorX;
    const dy = this.activePointer.y - this.anchorY;
    const dist = Math.min(this.maxDragRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    this.nub.setPosition(
      this.anchorX + Math.cos(angle) * dist,
      this.anchorY + Math.sin(angle) * dist,
    );
  }

  sampleMoveX(): -1 | 0 | 1 {
    if (!this.activePointer) return 0;
    const dx = this.activePointer.x - this.anchorX;
    if (dx > this.deadZone) return 1;
    if (dx < -this.deadZone) return -1;
    return 0;
  }
}
