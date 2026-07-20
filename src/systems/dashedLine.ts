/**
 * Pure geometry for the debug nav-aid's dashed path line (no Phaser
 * import, same split as jumpPhysics.ts/waterPhysics.ts) - splits a line
 * segment into alternating draw/skip pieces so debugOverlay.ts can just
 * stroke each returned piece with Graphics#lineBetween.
 */
export interface DashSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function computeDashSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLength: number,
  gapLength: number,
): DashSegment[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return [];

  const ux = dx / distance;
  const uy = dy / distance;
  const segments: DashSegment[] = [];

  let drawn = 0;
  while (drawn < distance) {
    const segmentEnd = Math.min(drawn + dashLength, distance);
    segments.push({
      x1: x1 + ux * drawn,
      y1: y1 + uy * drawn,
      x2: x1 + ux * segmentEnd,
      y2: y1 + uy * segmentEnd,
    });
    drawn = segmentEnd + gapLength;
  }

  return segments;
}
