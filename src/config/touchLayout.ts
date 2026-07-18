/**
 * Touch control layout (GDD §2.2b). All sizes/offsets are in dp
 * (density-independent px - 1dp == 1 CSS px, which is what makes the
 * ">=48dp touch target" rule meaningful regardless of device pixel
 * density). Converted to logical game units at runtime via
 * `src/systems/touchScale.ts`, since our logical canvas width/zoom
 * varies per device (see src/config/resolution.ts).
 *
 * Positions are anchored from the gameplay-critical safe zone's
 * corners, not the raw (possibly wider) screen, so buttons never land
 * in the extended-background margin on ultrawide devices.
 */
export type StickMode = 'floating' | 'fixed';

export const touchLayout = {
  /** Player-choice per GDD §2.2b; no settings UI to switch this yet (M5), so it's a build-time default. */
  stickMode: 'floating' as StickMode,
  opacity: 0.55,
  minTouchTargetDp: 48,

  floatingStick: {
    baseDiameterDp: 88,
    nubDiameterDp: 44,
    maxDragRadiusDp: 36,
    deadZoneDp: 6,
    anchorFromLeftDp: 72,
    anchorFromBottomDp: 64,
  },

  fixedDpad: {
    buttonSizeDp: 52,
    gapDp: 6,
    anchorFromLeftDp: 72,
    anchorFromBottomDp: 64,
  },

  buttons: {
    diameterDp: 56,
    jump: { fromRightDp: 44, fromBottomDp: 40 },
    shoot: { fromRightDp: 110, fromBottomDp: 72 },
    dash: { fromRightDp: 110, fromBottomDp: 8 },
  },

  weaponSwap: {
    diameterDp: 40,
    prev: { fromRightDp: 154, fromBottomDp: 120 },
    next: { fromRightDp: 96, fromBottomDp: 132 },
  },

  /** GDD §2.2b: "Hold-B auto-fire toggle in settings" - default here until M5 builds the settings menu. */
  autoFire: {
    enabledDefault: false,
    intervalFrames: 12,
  },
} as const;
