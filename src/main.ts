import Phaser from 'phaser';
import { buildGameConfig } from '@/config/gameConfig';
import { setupAppLifecycle } from '@/systems/lifecycle';
import { requestLandscapeLock } from '@/systems/orientation';
import { setupImmersiveStatusBar } from '@/systems/statusBar';

requestLandscapeLock();
void setupImmersiveStatusBar();

const game = new Phaser.Game(buildGameConfig());

setupAppLifecycle(game);
