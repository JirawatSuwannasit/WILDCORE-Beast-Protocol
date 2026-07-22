import { describe, expect, it } from 'vitest';
import foundryMap from './foundry.json';
import foundryVerification from './foundry-verification.json';
import {
  calculateStageVerificationMetrics,
  verifyFoundryStage,
  type StageVerificationData,
} from './stageVerifier';

const foundry = foundryVerification as StageVerificationData;

function getTile(map: typeof foundryMap, col: number, row: number): number {
  const ground = map.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'ground');
  if (!ground || !('data' in ground) || !ground.data) throw new Error('ground tile layer missing');
  return Number(ground.data[row * map.width + col] ?? 0);
}

function assertPostMidbossTransitionReachable(map: typeof foundryMap): void {
  const checkpoints = map.layers.find(
    (layer) => layer.type === 'objectgroup' && layer.name === 'checkpoints',
  );
  const checkpoint = checkpoints?.objects?.find(
    (object) => object.name === 'checkpoint-post-midboss',
  );
  if (!checkpoint) throw new Error('post-midboss checkpoint missing');

  const checkpointCol = Math.floor((checkpoint.x + checkpoint.width / 2) / map.tilewidth);
  const checkpointFootRow = Math.floor((checkpoint.y + checkpoint.height) / map.tileheight);
  const missingContinuationCols = Array.from(
    { length: 15 },
    (_, i) => checkpointCol + 18 + i,
  ).filter((col) => getTile(map, col, checkpointFootRow) !== 2);
  if (missingContinuationCols.length > 0) {
    throw new Error(
      `post-midboss transition landing missing at cols ${missingContinuationCols.join(',')}`,
    );
  }

  const hasUpperLanding = Array.from({ length: 8 }, (_, i) => checkpointCol + 11 + i).some(
    (col) => getTile(map, col, checkpointFootRow - 12) === 2,
  );
  if (!hasUpperLanding) throw new Error('post-midboss transition upper landing missing');
}

describe('Ember Foundry §2.7 verification metadata', () => {
  it('passes the automated GDD §2.7 verifier', () => {
    expect(() => verifyFoundryStage(foundry)).not.toThrow();
  });

  it('reports the exact terrain metrics used in the PR checklist', () => {
    const metrics = calculateStageVerificationMetrics(foundry);
    expect(metrics.totalScreens).toBe(35);
    expect(metrics.traversalPixels).toBe(11200);
    expect(metrics.verticalPathPct).toBeCloseTo(51.4285714286, 6);
    expect(metrics.macroDirectionChanges).toBe(7);
    expect(metrics.macroLongestRun).toBe(2);
    expect(metrics.screenLongestRun).toBe(3);
    expect(metrics.longestNearFlatRun).toBe(3);
    expect(metrics.maxMandatoryGapTiles).toBe(3);
  });

  it('foundry post-midboss transition is base-kit reachable', () => {
    expect(() => assertPostMidbossTransitionReachable(foundryMap)).not.toThrow();

    const mutated = structuredClone(foundryMap);
    const ground = mutated.layers.find(
      (layer) => layer.type === 'tilelayer' && layer.name === 'ground',
    );
    if (!ground || !('data' in ground) || !ground.data)
      throw new Error('ground tile layer missing');
    const groundData = ground.data;
    for (let col = 271; col <= 285; col += 1) groundData[240 * mutated.width + col] = 0;

    expect(() => assertPostMidbossTransitionReachable(mutated)).toThrow(
      'post-midboss transition landing missing at cols 271,272,273,274,275,276,277,278,279,280,281,282,283,284,285',
    );
  });
  it('proves branch, controlled descent, and multi-floor ranges explicitly', () => {
    expect(foundry.branch).toMatchObject({
      forkScreen: 17,
      upperRouteScreens: [17, 18],
      lowerRouteScreens: [17, 18],
      rejoinScreen: 19,
      connectedToMainRoute: true,
      requiresDash: false,
    });
    expect(foundry.structuralElements.controlledDescent).toMatchObject({
      screens: [29, 30],
      steerable: true,
      visibleLandingHalfScreenBeforeCommitment: true,
      noBlindLandingOntoHazard: true,
      slowfallPushY: -90,
      maxFallSpeedY: 130,
    });
    expect(foundry.structuralElements.multiFloorRoom.selectableFloors).toHaveLength(3);
  });
});
