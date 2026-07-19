import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import type { TaggedUtility } from '@/actors/WeaponController';
import type { UtilityTag } from '@/data/weaknessWheel';

const SIZE = 16;

/**
 * Generic placeholder stand-in for the kind of tagged stage object each
 * boss weapon's utility hook is meant to interact with (GDD §3 prose:
 * "powers dead machinery", "douses fires", "melts ice walls", "cuts
 * ropes/cables", "corrodes rusted blocks", "triggers weak floors" - and
 * "phase" for Umbra Claw, see DECISIONS.md). Real stages will eventually
 * want bespoke visuals/behavior per tag (a generator that lights up, a
 * flame that gutters out, ...); this is the M3 placeholder that proves
 * the tag-matching plumbing end-to-end - one per tag, tested in the gym.
 */
export class UtilityTarget extends Phaser.Physics.Arcade.Sprite implements TaggedUtility {
  private activated = false;
  private readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly requiredTag: UtilityTag,
  ) {
    super(scene, x, y, getRectTexture(scene, `utility-${requiredTag}`, SIZE, SIZE, THEME.panel));
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.label = scene.add
      .text(x, y - SIZE / 2 - 8, requiredTag, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);
  }

  get isActivated(): boolean {
    return this.activated;
  }

  tryActivate(tag: UtilityTag): boolean {
    if (this.activated || tag !== this.requiredTag) return false;
    this.activated = true;
    this.setTexture(
      getRectTexture(
        this.scene,
        `utility-${this.requiredTag}-active`,
        SIZE,
        SIZE,
        THEME.accentAmber,
      ),
    );
    this.label.setColor(THEME.textCream).setText(`${this.requiredTag}!`);
    return true;
  }

  reset(): void {
    this.activated = false;
    this.setTexture(
      getRectTexture(this.scene, `utility-${this.requiredTag}`, SIZE, SIZE, THEME.panel),
    );
    this.label.setText(this.requiredTag);
  }
}
