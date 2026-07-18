import { BaseScene } from '@/scenes/BaseScene';

export class BootScene extends BaseScene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // Nothing to preload yet - placeholder rectangles only (rule #5).
    // Boot exists as the hand-off point for future load-screen wiring.
    this.scene.start('Title');
  }
}
