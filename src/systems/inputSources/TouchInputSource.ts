import Phaser from 'phaser';
import { touchLayout } from '@/config/touchLayout';
import { dpToLogicalPx } from '@/systems/touchScale';
import { THEME } from '@/config/theme';
import type { InputSnapshot, InputSource } from '@/systems/input';
import { TouchButton } from '@/systems/inputSources/TouchButton';
import { FloatingStick } from '@/systems/inputSources/FloatingStick';
import { FixedDpad } from '@/systems/inputSources/FixedDpad';

export interface TouchInputZone {
  safeLeft: number;
  safeRight: number;
  worldHeight: number;
}

function makeRoundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  diameterDp: number,
  label: string,
  color: number,
): TouchButton {
  const radius = dpToLogicalPx(scene, diameterDp) / 2;
  const circle = scene.add
    .circle(x, y, radius, color, touchLayout.opacity)
    .setScrollFactor(0)
    .setDepth(900);
  scene.add
    .text(x, y, label, { fontFamily: 'monospace', fontSize: '11px', color: THEME.textCream })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(901);
  return new TouchButton(scene, circle);
}

/**
 * Builds the on-screen touch UI (GDD §2.2b) and reports it through the
 * same InputSource interface as keyboard/gamepad. Left thumb: floating
 * stick or fixed D-pad (touchLayout.stickMode). Right thumb: A Jump,
 * B Shoot (hold = charge), C Dash, weapon-swap arrows.
 */
export class TouchInputSource implements InputSource {
  private readonly stick?: FloatingStick;
  private readonly dpad?: FixedDpad;
  private readonly jump: TouchButton;
  private readonly shoot: TouchButton;
  private readonly dash: TouchButton;
  private readonly weaponPrev: TouchButton;
  private readonly weaponNext: TouchButton;

  constructor(scene: Phaser.Scene, zone: TouchInputZone) {
    const width = zone.safeRight - zone.safeLeft;
    const height = zone.worldHeight;

    const left = touchLayout.leftCluster;
    const leftAnchorX = zone.safeLeft + width * left.anchorFromLeftPct;
    const leftAnchorY = height - height * left.anchorFromBottomPct;

    const right = touchLayout.rightCluster;
    const rightAnchorX = zone.safeRight - width * right.anchorFromRightPct;
    const rightAnchorY = height - height * right.anchorFromBottomPct;

    if (touchLayout.stickMode === 'floating') {
      const zoneDiameter = dpToLogicalPx(scene, left.zoneDiameterDp);
      this.stick = new FloatingStick(scene, {
        x: leftAnchorX - zoneDiameter / 2,
        y: leftAnchorY - zoneDiameter / 2,
        width: zoneDiameter,
        height: zoneDiameter,
      });
    } else {
      this.dpad = new FixedDpad(scene, leftAnchorX, leftAnchorY);
    }

    const offset = (dp: { offsetXDp: number; offsetYDp: number }): [number, number] => [
      rightAnchorX - dpToLogicalPx(scene, dp.offsetXDp),
      rightAnchorY - dpToLogicalPx(scene, dp.offsetYDp),
    ];

    const btn = touchLayout.buttons;
    this.jump = makeRoundButton(scene, ...offset(btn.jump), btn.diameterDp, 'A', THEME.accentAmber);
    this.shoot = makeRoundButton(
      scene,
      ...offset(btn.shoot),
      btn.diameterDp,
      'B',
      THEME.accentCoral,
    );
    this.dash = makeRoundButton(scene, ...offset(btn.dash), btn.diameterDp, 'C', THEME.accentTeal);

    const swap = touchLayout.weaponSwap;
    this.weaponPrev = makeRoundButton(
      scene,
      ...offset(swap.prev),
      swap.diameterDp,
      '<',
      THEME.panel,
    );
    this.weaponNext = makeRoundButton(
      scene,
      ...offset(swap.next),
      swap.diameterDp,
      '>',
      THEME.panel,
    );
  }

  /** Call once per render frame to keep the stick nub visual in sync. */
  refreshVisuals(): void {
    this.stick?.refreshVisual();
  }

  sample(): InputSnapshot {
    const moveX = this.stick ? this.stick.sampleMoveX() : (this.dpad?.sampleMoveX() ?? 0);

    return {
      moveX,
      jumpHeld: this.jump.isHeld,
      dashHeld: this.dash.isHeld,
      shootHeld: this.shoot.isHeld,
      weaponNextHeld: this.weaponNext.isHeld,
      weaponPrevHeld: this.weaponPrev.isHeld,
    };
  }
}
