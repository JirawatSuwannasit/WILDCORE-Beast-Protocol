import Phaser from 'phaser';
import { buildScaleConfig, GAME_HEIGHT, GAME_WIDTH } from '@/config/resolution';
import { BootScene } from '@/scenes/BootScene';
import { TitleScene } from '@/scenes/TitleScene';
import { StageSelectScene } from '@/scenes/StageSelectScene';
import { StageScene } from '@/scenes/StageScene';
import { THEME } from '@/config/theme';

export function buildGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: THEME.background,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: buildScaleConfig(),
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fps: 60,
      },
    },
    fps: {
      target: 60,
      min: 30,
    },
    scene: [BootScene, TitleScene, StageSelectScene, StageScene],
  };
}
