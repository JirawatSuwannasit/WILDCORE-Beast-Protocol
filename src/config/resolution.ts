/**
 * Gameplay-critical safe zone (GDD §0): 320x180, 16:9. Everything that
 * must be readable/reachable (UI, hazards, telegraphs) is authored to
 * fit inside this frame and stays centered in it regardless of device
 * aspect ratio.
 */
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

/**
 * Widest device aspect ratio the GDD asks us to support (§0: up to
 * 21:9). Backgrounds extend to fill device width beyond 16:9 up to this
 * ratio instead of pillarboxing; only wider-than-21:9 devices pillarbox
 * past this cap.
 */
export const MAX_ASPECT_RATIO = 21 / 9;
export const EXTENDED_WIDTH = Math.round(GAME_HEIGHT * MAX_ASPECT_RATIO);

/**
 * The world width to render for a given viewport. Clamped to
 * [GAME_WIDTH, EXTENDED_WIDTH]: narrower-than-16:9 viewports still get
 * the full 320px critical frame, wider-than-21:9 viewports cap at the
 * GDD's supported range instead of extending indefinitely.
 */
export function computeRenderWidth(viewportWidth: number, viewportHeight: number): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return GAME_WIDTH;
  const idealWidth = (viewportWidth / viewportHeight) * GAME_HEIGHT;
  return Math.min(EXTENDED_WIDTH, Math.max(GAME_WIDTH, Math.round(idealWidth)));
}
