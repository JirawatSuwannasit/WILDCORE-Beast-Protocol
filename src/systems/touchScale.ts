import type Phaser from 'phaser';

/**
 * Converts a dp size to logical game units at the current zoom, so a
 * touch target authored as ">=48dp" actually measures >=48 CSS px on
 * screen regardless of device pixel density or the integer zoom factor
 * Phaser picked for this device. `displayScale` already folds in both
 * the integer zoom and any additional FIT-mode CSS scaling.
 */
export function dpToLogicalPx(scene: Phaser.Scene, dp: number): number {
  return dp * scene.scale.displayScale.x;
}
