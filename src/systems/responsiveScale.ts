import type Phaser from 'phaser';
import { computeRenderWidth, GAME_HEIGHT } from '@/config/resolution';

/**
 * Keeps the game's base width matched to the device aspect ratio after
 * boot (foldable unfold, split-screen, or a resized dev-preview window).
 * The initial width is already computed correctly at game-creation time
 * (see buildGameConfig); this only handles it changing afterwards.
 */
export function setupResponsiveScale(game: Phaser.Game): void {
  const applySize = (): void => {
    const width = computeRenderWidth(window.innerWidth, window.innerHeight);
    if (width !== game.scale.gameSize.width) {
      game.scale.setGameSize(width, GAME_HEIGHT);
    }
  };

  window.addEventListener('resize', applySize);
  window.addEventListener('orientationchange', applySize);
}
