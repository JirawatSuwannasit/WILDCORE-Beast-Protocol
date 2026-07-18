import type Phaser from 'phaser';

/**
 * Generates (and caches) a solid-color rectangle texture, per rule #5:
 * placeholder colored rectangles until real art is integrated in M8.
 * Using real textures (rather than Shape GameObjects) keeps every actor
 * on Sprite so swapping in spritesheets later is a texture change, not
 * a rewrite.
 */
export function getRectTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  color: number,
): string {
  if (!scene.textures.exists(key)) {
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
  return key;
}
