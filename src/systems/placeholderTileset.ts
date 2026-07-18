import type Phaser from 'phaser';

/**
 * Generates a horizontal strip texture of solid-color tiles (one per
 * `colors` entry) for use with `map.addTilesetImage()` - a placeholder
 * tileset per rule #5, matching the tile order/count declared in the
 * Tiled JSON's `tilesets[0]` (see src/data/stages/speedway.json).
 */
export function getPlaceholderTilesetTexture(
  scene: Phaser.Scene,
  key: string,
  tileSize: number,
  colors: readonly number[],
): string {
  if (!scene.textures.exists(key)) {
    const graphics = scene.add.graphics();
    colors.forEach((color, i) => {
      graphics.fillStyle(color, 1);
      graphics.fillRect(i * tileSize, 0, tileSize, tileSize);
      graphics.lineStyle(1, 0x000000, 0.25);
      graphics.strokeRect(i * tileSize + 0.5, 0.5, tileSize - 1, tileSize - 1);
    });
    graphics.generateTexture(key, tileSize * colors.length, tileSize);
    graphics.destroy();
  }
  return key;
}
