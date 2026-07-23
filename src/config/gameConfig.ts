import Phaser from 'phaser';
import { computeRenderWidth, GAME_HEIGHT } from '@/config/resolution';
import { BootScene } from '@/scenes/BootScene';
import { TitleScene } from '@/scenes/TitleScene';
import { StageSelectScene } from '@/scenes/StageSelectScene';
import { GymScene } from '@/scenes/GymScene';
import { SpeedwayScene } from '@/scenes/SpeedwayScene';
import { ReservoirScene } from '@/scenes/ReservoirScene';
import { EmberFoundryScene } from '@/scenes/EmberFoundryScene';
import { THEME } from '@/config/theme';

function buildScaleConfig(): Phaser.Types.Core.ScaleConfig {
  return {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: computeRenderWidth(window.innerWidth, window.innerHeight),
    height: GAME_HEIGHT,
    zoom: Phaser.Scale.MAX_ZOOM,
  };
}

export function buildGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'app',
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
    input: {
      // >=4 simultaneous touches: move + jump + shoot(hold-to-charge) +
      // dash all at once (GDD §2.2b: "multi-touch safe").
      activePointers: 4,
      gamepad: true,
    },
    scene: [
      BootScene,
      TitleScene,
      StageSelectScene,
      GymScene,
      SpeedwayScene,
      ReservoirScene,
      EmberFoundryScene,
    ],
  };
}
