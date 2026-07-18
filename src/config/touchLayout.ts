/**
 * Touch control layout (GDD §2.2b). All sizes/offsets are in dp
 * (density-independent px - 1dp == 1 CSS px, which is what makes the
 * ">=48dp touch target" rule meaningful regardless of device pixel
 * density). Converted to logical game units at runtime via
 * `src/systems/touchScale.ts`, since our logical canvas width/zoom
 * varies per device (see src/config/resolution.ts).
 *
 * Positions are anchored from the play area actually rendered on
 * screen (the full extend-aware canvas width, safe-area-inset already
 * excluded at the DOM level - see index.html's env(safe-area-inset-*)
 * padding, which keeps the whole canvas off the notch/gesture bar
 * before any in-game coordinate is computed), not the narrower
 * 320px gameplay-critical frame - a thumb reaches based on where the
 * physical screen edges are, which tracks the full canvas width.
 */
export type StickMode = 'floating' | 'fixed';

export const touchLayout = {
  /** Player-choice per GDD §2.2b; no settings UI to switch this yet (M5), so it's a build-time default. */
  stickMode: 'floating' as StickMode,
  opacity: 0.55,
  minTouchTargetDp: 48,

  /**
   * Where each cluster's reference point sits, as a fraction of the
   * play area's width/height rather than fixed dp - so the clusters
   * stay at a comfortable, constant-feeling thumb reach from 16:9 up
   * to 21:9 (GDD §0) instead of drifting toward the physical corner as
   * the canvas widens. ~12-15% in from the side edge, ~30-35% up from
   * the bottom: roughly where a relaxed thumb rests on a phone held in
   * landscape, not jammed into the corner.
   */
  leftCluster: {
    anchorFromLeftPct: 0.135,
    anchorFromBottomPct: 0.325,
    /** Floating-stick touch-detection zone diameter, centered on the anchor. */
    zoneDiameterDp: 160,
  },
  rightCluster: {
    anchorFromRightPct: 0.135,
    anchorFromBottomPct: 0.325,
  },

  floatingStick: {
    baseDiameterDp: 88,
    nubDiameterDp: 44,
    maxDragRadiusDp: 36,
    deadZoneDp: 6,
  },

  fixedDpad: {
    buttonSizeDp: 52,
    gapDp: 6,
  },

  buttons: {
    diameterDp: 56,
    /** Offsets from rightCluster's anchor, in dp: +X toward screen
     * center, +Y upward. Preserves the original A/B/C triangle spacing
     * exactly (only the cluster's overall anchor point moved) - Jump
     * sits at the anchor itself, matching GDD §2.2b's primary button. */
    jump: { offsetXDp: 0, offsetYDp: 0 },
    shoot: { offsetXDp: 66, offsetYDp: 32 },
    dash: { offsetXDp: 66, offsetYDp: -32 },
  },

  weaponSwap: {
    diameterDp: 40,
    prev: { offsetXDp: 110, offsetYDp: 80 },
    next: { offsetXDp: 52, offsetYDp: 92 },
  },

  /** GDD §2.2b: "Hold-B auto-fire toggle in settings" - default here until M5 builds the settings menu. */
  autoFire: {
    enabledDefault: false,
    intervalFrames: 12,
  },
} as const;
