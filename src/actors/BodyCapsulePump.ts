import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import type { TaggedUtility } from '@/actors/WeaponController';
import type { UtilityTag } from '@/data/weaknessWheel';
import type { BodyCapsuleStub } from '@/actors/BodyCapsuleStub';

const SIZE = { width: 16, height: 24 };

/**
 * GDD §3.2 secret gate: "requires Volt Chain to power the pump; show a
 * readable locked hint when the player lacks Volt Chain." Volt Chain is
 * the only weapon tagged 'power' (weaknessWheel.ts) - firing it at this
 * target is exactly "using Volt Chain to power the pump" per the same
 * utility-tag mechanism every other weapon-gated stage object uses (GDD
 * §3 prose: "powers dead machinery"; see UtilityTarget for the pattern
 * this mirrors). The readable hint is a static sign, visible the whole
 * time the pump is unpowered - correct whether the player has never seen
 * Volt Chain yet or simply isn't holding it equipped right now.
 */
export class BodyCapsulePump extends Phaser.Physics.Arcade.Sprite implements TaggedUtility {
  readonly requiredTag: UtilityTag = 'power';

  private readonly hintText: Phaser.GameObjects.Text;
  private powered = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly capsule: BodyCapsuleStub,
  ) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'body-capsule-pump', SIZE.width, SIZE.height, THEME.panel),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.hintText = scene.add
      .text(x, y - SIZE.height / 2 - 10, 'PUMP\nNEEDS\nVOLT CHAIN', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#f5a742', // THEME.accentAmber as a CSS string - Text style needs a string, not the hex-number theme constant
        align: 'center',
      })
      .setOrigin(0.5);
  }

  get isPowered(): boolean {
    return this.powered;
  }

  tryActivate(tag: UtilityTag): boolean {
    if (this.powered || tag !== this.requiredTag) return false;
    this.powered = true;
    this.setTint(THEME.accentTeal);
    this.hintText.setText('PUMP\nPOWERED').setColor(THEME.textCream);
    this.capsule.unlock();
    return true;
  }
}
