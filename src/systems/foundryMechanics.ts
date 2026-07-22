/** Foundry-only deterministic helpers kept Phaser-free for verifier/runtime tests. */
export function applyLavafallSlowfall(velocityY: number, maxFallSpeedY: number): number {
  if (velocityY <= 0) return velocityY;
  return Math.min(velocityY, maxFallSpeedY);
}
