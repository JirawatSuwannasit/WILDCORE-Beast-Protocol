import { describe, expect, it } from 'vitest';
import foundryVerification from './foundry-verification.json';
import {
  calculateStageVerificationMetrics,
  verifyFoundryStage,
  type StageVerificationData,
} from './stageVerifier';

const foundry = foundryVerification as StageVerificationData;

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
