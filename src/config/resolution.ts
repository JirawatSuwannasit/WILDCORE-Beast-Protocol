import Phaser from 'phaser';

/**
 * Native gameplay-critical frame (GDD §0): 320x180, 16:9.
 * Everything that must be readable/reachable (UI, hazards, telegraphs)
 * is authored to fit inside this frame regardless of device aspect ratio.
 */
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

/**
 * Widest device aspect ratio the GDD asks us to support (§0: up to 21:9).
 * Stage backgrounds are meant to extend into the extra width on wider
 * screens instead of showing black bars (see DECISIONS.md — deferred
 * until stage background art exists in M2+).
 */
export const MAX_ASPECT_RATIO = 21 / 9;
export const EXTENDED_WIDTH = Math.round(GAME_HEIGHT * MAX_ASPECT_RATIO);

export function buildScaleConfig(): Phaser.Types.Core.ScaleConfig {
  return {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: Phaser.Scale.MAX_ZOOM,
  };
}
