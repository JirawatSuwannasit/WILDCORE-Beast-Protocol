import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { InterpolatedPhysicsSprite } from '@/actors/InterpolatedPhysicsSprite';

const PLATFORM_HEIGHT = 8;

/** Back-and-forth platform for the gym (M1 spec). Riders are carried in GymScene via `stepDelta`. */
export class MovingPlatform extends InterpolatedPhysicsSprite {
  private readonly minX: number;
  private readonly maxX: number;
  private readonly speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    rangeX: number,
    speed: number,
  ) {
    const texture = getRectTexture(
      scene,
      `platform-${width}`,
      width,
      PLATFORM_HEIGHT,
      THEME.accentTeal,
    );
    super(scene, x, y, texture);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(width, PLATFORM_HEIGHT);

    this.minX = x - rangeX / 2;
    this.maxX = x + rangeX / 2;
    this.speed = speed;
    body.setVelocityX(speed);
  }

  fixedUpdate(): void {
    this.captureRenderStep();

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.center.x <= this.minX && body.velocity.x < 0) {
      body.setVelocityX(this.speed);
    } else if (body.center.x >= this.maxX && body.velocity.x > 0) {
      body.setVelocityX(-this.speed);
    }
  }
}
