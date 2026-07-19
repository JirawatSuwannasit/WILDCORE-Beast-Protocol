/**
 * DEBUG TOOL ONLY - not part of the player kit or GDD design (see
 * DECISIONS.md: remove before v1.0). `debugBuildEnabled` is false in a
 * default `vite build` (Vercel preview, the eventual signed release AAB),
 * true only for `npm run dev` and the debug-APK build mode - so these
 * flags can never be turned on in a release/production build regardless
 * of any attempt to flip them.
 */
export const debugBuildEnabled = import.meta.env.DEV || import.meta.env.MODE === 'debug';

export const debugFlags = {
  /** Allows one extra mid-air jump, for testing stage traversal/reachability only. */
  doubleJump: false,
};

export function toggleDebugDoubleJump(): void {
  if (!debugBuildEnabled) return;
  debugFlags.doubleJump = !debugFlags.doubleJump;
}
