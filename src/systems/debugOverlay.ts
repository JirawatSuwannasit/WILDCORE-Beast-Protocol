import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import type { Player } from '@/actors/Player';
import type { TargetDummy } from '@/actors/TargetDummy';
import { debugBuildEnabled, debugFlags, toggleDebugDoubleJump } from '@/systems/debugFlags';
import { TILE_SIZE } from '@/config/playerTuning';
import { GAME_WIDTH } from '@/config/resolution';
import { computeDashSegments } from '@/systems/dashedLine';

const THREE_FINGER_COUNT = 3;

/**
 * A named world landmark (checkpoint, beat marker, or boss door) shown by
 * the `next:` debug readout and the path-line nav aid. `kind: 'main'`
 * landmarks are connected into the route line, in ascending-x order;
 * `kind: 'branch'` landmarks (secret capsules, off-route detours) are
 * drawn as a dim spur off the nearest main-path node instead.
 */
export interface DebugLandmark {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly kind: 'main' | 'branch';
}

const PATH_LINE_COLOR = 0xffffff;
const PATH_LINE_DASH_PX = 10;
const PATH_LINE_GAP_PX = 6;
const PATH_NODE_RADIUS = 4;
const BRANCH_SPUR_COLOR = 0xaaaaaa;
const BRANCH_SPUR_ALPHA = 0.45;
const BRANCH_NODE_RADIUS = 3;

/**
 * F3 / three-finger-tap toggled debug view (M1 spec): hitboxes, state,
 * velocity, coyote/buffer indicators, and (dev/debug builds only) a
 * stage-authoring nav aid - a dashed line tracing the intended main path
 * from the player through every upcoming beat/checkpoint node to the boss
 * door, so a route can be sanity-checked without final art. Touch zones
 * aren't drawn separately - the on-screen buttons are always rendered as
 * translucent shapes at their real hit-test bounds, so they already
 * double as their own zone visualization without a redundant overlay
 * layer.
 */
export class DebugOverlay {
  private active = false;
  private readonly worldGraphics: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly doubleJumpButton: Phaser.GameObjects.Text | null;
  private readonly activePointerIds = new Set<number>();
  private threeFingerTriggered = false;
  private readonly mainLandmarks: readonly DebugLandmark[];
  private readonly branchLandmarks: readonly DebugLandmark[];

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    private readonly targets: readonly TargetDummy[],
    landmarks: readonly DebugLandmark[] = [],
  ) {
    // Sorted once up front rather than trusting caller order - the path
    // line and `next:` readout both walk this in ascending-x route order.
    this.mainLandmarks = landmarks.filter((l) => l.kind === 'main').sort((a, b) => a.x - b.x);
    this.branchLandmarks = landmarks.filter((l) => l.kind === 'branch');

    this.worldGraphics = scene.add.graphics().setDepth(1900).setVisible(false);
    this.text = scene.add
      .text(6, 16, '', { fontFamily: 'monospace', fontSize: '9px', color: THEME.textCream })
      .setScrollFactor(0)
      .setDepth(1900)
      .setVisible(false);

    // DEBUG TOOL ONLY (see src/systems/debugFlags.ts): a tappable toggle
    // for testing traversal, only ever created/interactive in a dev/debug
    // build - `toggleDebugDoubleJump` itself is also a no-op outside one,
    // so this is a second, independent guard, not the only one.
    this.doubleJumpButton = debugBuildEnabled
      ? scene.add
          .text(scene.scale.width - 6, 16, '', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: THEME.textCream,
            backgroundColor: '#000000',
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
          .setDepth(1900)
          .setVisible(false)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => toggleDebugDoubleJump())
      : null;

    scene.input.keyboard?.on('keydown-F3', () => this.toggle());

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointerIds.add(pointer.id);
      if (this.activePointerIds.size >= THREE_FINGER_COUNT && !this.threeFingerTriggered) {
        this.threeFingerTriggered = true;
        this.toggle();
      }
    });
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.activePointerIds.delete(pointer.id);
      if (this.activePointerIds.size < THREE_FINGER_COUNT) this.threeFingerTriggered = false;
    });
  }

  toggle(): void {
    this.active = !this.active;
    this.worldGraphics.setVisible(this.active);
    this.text.setVisible(this.active);
    this.doubleJumpButton?.setVisible(this.active);
  }

  /** Call once per render frame, after positions are finalized for this frame. */
  refresh(): void {
    if (!this.active) return;

    this.worldGraphics.clear();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.worldGraphics.lineStyle(1, 0x00ff00, 1);
    this.worldGraphics.strokeRect(body.x, body.y, body.width, body.height);

    const hurtBody = this.player.hurtboxZone.body as Phaser.Physics.Arcade.Body;
    this.worldGraphics.lineStyle(1, 0xff00ff, 1);
    this.worldGraphics.strokeRect(hurtBody.x, hurtBody.y, hurtBody.width, hurtBody.height);

    this.worldGraphics.lineStyle(1, 0xffff00, 1);
    for (const dummy of this.targets) {
      const dummyBody = dummy.body as Phaser.Physics.Arcade.Body;
      this.worldGraphics.strokeRect(dummyBody.x, dummyBody.y, dummyBody.width, dummyBody.height);
    }

    const info = this.player.debugInfo;
    const lines = [
      `state: ${info.state}`,
      `vel: ${info.velocityX.toFixed(0)}, ${info.velocityY.toFixed(0)}`,
      `grounded: ${info.grounded}`,
      `coyote: ${info.coyoteActive}`,
      `jumpBuf: ${info.jumpBufferActive}`,
      `dashBuf: ${info.dashBufferActive}`,
      `hp: ${this.player.hitPoints}`,
    ];

    // DEBUG TOOL ONLY (see src/systems/debugFlags.ts): world-position
    // readouts + the path-line nav aid, for stage authoring, dev builds only.
    if (debugBuildEnabled) {
      const x = this.player.x;
      const y = this.player.y;
      lines.push(`pos: ${x.toFixed(0)}, ${y.toFixed(0)}`);
      lines.push(`tile: ${Math.floor(x / TILE_SIZE)}, ${Math.floor(y / TILE_SIZE)}`);
      lines.push(`screen: ${Math.floor(x / GAME_WIDTH) + 1}`);
      const nextId = this.nextLandmarkId(x);
      if (nextId !== null) lines.push(`next: ${nextId}`);

      this.drawPathLine();
    }

    this.text.setText(lines);

    this.doubleJumpButton?.setText(`[DEBUG] dbl-jump: ${debugFlags.doubleJump ? 'ON' : 'OFF'}`);
  }

  private nextLandmarkId(playerX: number): string | null {
    const ahead = this.mainLandmarks.find((landmark) => landmark.x > playerX);
    return (ahead ?? this.mainLandmarks.at(-1))?.id ?? null;
  }

  /**
   * Main path: a bright dashed polyline from the player through every
   * upcoming beat/checkpoint node (ascending x, i.e. route order), ending
   * at the boss door - unbroken through any branch point. Secret/branch
   * landmarks (e.g. a capsule off a side path) are drawn as a separate,
   * dim, unbroken spur from the nearest main-path node out to the secret,
   * so they read as an optional detour rather than part of the route.
   */
  private drawPathLine(): void {
    const ahead = this.mainLandmarks.filter((landmark) => landmark.x > this.player.x);
    if (ahead.length > 0) {
      this.worldGraphics.lineStyle(2, PATH_LINE_COLOR, 1);
      let fromX = this.player.x;
      let fromY = this.player.y;
      for (const node of ahead) {
        for (const seg of computeDashSegments(
          fromX,
          fromY,
          node.x,
          node.y,
          PATH_LINE_DASH_PX,
          PATH_LINE_GAP_PX,
        )) {
          this.worldGraphics.lineBetween(seg.x1, seg.y1, seg.x2, seg.y2);
        }
        this.worldGraphics.fillStyle(PATH_LINE_COLOR, 1);
        this.worldGraphics.fillCircle(node.x, node.y, PATH_NODE_RADIUS);
        fromX = node.x;
        fromY = node.y;
      }
    }

    if (this.branchLandmarks.length === 0 || this.mainLandmarks.length === 0) return;
    this.worldGraphics.lineStyle(1, BRANCH_SPUR_COLOR, BRANCH_SPUR_ALPHA);
    for (const branch of this.branchLandmarks) {
      const nearestMain = this.mainLandmarks.reduce((nearest, candidate) =>
        distance(candidate, branch) < distance(nearest, branch) ? candidate : nearest,
      );
      this.worldGraphics.lineBetween(nearestMain.x, nearestMain.y, branch.x, branch.y);
      this.worldGraphics.fillStyle(BRANCH_SPUR_COLOR, BRANCH_SPUR_ALPHA + 0.2);
      this.worldGraphics.fillCircle(branch.x, branch.y, BRANCH_NODE_RADIUS);
    }
  }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
