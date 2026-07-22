export type Direction = 'L' | 'R' | 'U' | 'D' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';

export interface StageVerificationScreen {
  id: number;
  beat: string;
  movement: Direction;
  surfaceHeight: { enterRow: number; exitRow: number; verticalVariationRows: number };
  encounters: string[];
  hazards: string[];
  signature: string;
  gimmicks: string[];
  maxMandatoryGapTiles: number;
}

export interface StageRouteNode {
  id: string;
  sequenceIndex: number;
  worldPosition: { x: number; y: number };
  screenIndex: number;
  beatName: string;
  movementFromPrevious: Direction | 'START';
  segmentKind: 'horizontal' | 'ascent' | 'descent' | 'branch' | 'rejoin' | 'arena' | 'transition';
  requiredMovementAbility: 'baseKit';
  baseKitTraversalValid: boolean;
  activeEnemyTypes: string[];
  activeHazardTypes: string[];
  activeGimmicks: string[];
  structuralElementName: string | null;
}

export interface StageVerificationData {
  dominantAxis: 'horizontal' | 'vertical' | 'mixed';
  screenPixelLength: number;
  targetTraversalScreens: { min: number; max: number };
  targetTraversalPixels: { min: number; max: number };
  verticalPathTargetPct: number;
  mainRouteScreenIds: number[];
  macroBeatDirections: Direction[];
  branch: {
    forkScreen: number;
    upperRouteScreens: number[];
    lowerRouteScreens: number[];
    rejoinScreen: number;
    connectedToMainRoute: boolean;
    requiresDash: boolean;
  };
  structuralElements: {
    ascentShaft: { screens: number[]; verticalCamera: boolean; heatVentAssisted: boolean };
    controlledDescent: {
      screens: number[];
      zoneMarker: string;
      steerable: boolean;
      visibleLandingHalfScreenBeforeCommitment: boolean;
      noBlindLandingOntoHazard: boolean;
      slowfallHeatVents: string[];
      slowfallPushY: number;
      maxFallSpeedY: number;
    };
    multiFloorRoom: {
      screens: number[];
      selectableFloors: string[];
      rejoinScreen: number;
      genuineLayerChoice: boolean;
    };
  };
  hazardIntroductions: Array<{ hazard: string; screen: number; beat: string }>;
  checkpoints: Array<{ id: string; order: number; screen: number }>;
  screens: StageVerificationScreen[];
  routeNodes: StageRouteNode[];
}

export interface StageVerificationMetrics {
  totalScreens: number;
  traversalPixels: number;
  verticalScreens: number;
  verticalPathPct: number;
  macroDirectionChanges: number;
  macroLongestRun: number;
  screenDirectionChanges: number;
  screenLongestRun: number;
  longestNearFlatRun: number;
  encounterDensityScreensPerEncounter: number;
  consecutiveIdenticalSignatures: Array<[number, number, string]>;
  maxMandatoryGapTiles: number;
}

function countChanges(directions: Direction[]): number {
  let changes = 0;
  for (let i = 1; i < directions.length; i += 1) {
    if (directions[i] !== directions[i - 1]) changes += 1;
  }
  return changes;
}

function longestRun(directions: Direction[]): number {
  let longest = 1;
  let run = 1;
  for (let i = 1; i < directions.length; i += 1) {
    if (directions[i] === directions[i - 1]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return directions.length === 0 ? 0 : longest;
}

function isVertical(direction: Direction): boolean {
  return direction === 'U' || direction === 'D' || direction === 'UP' || direction === 'DOWN';
}

export function calculateStageVerificationMetrics(
  data: StageVerificationData,
): StageVerificationMetrics {
  const screenDirections = data.screens.map((screen) => screen.movement);
  const verticalScreens = screenDirections.filter(isVertical).length;
  const encounters = data.screens.reduce((sum, screen) => sum + screen.encounters.length, 0);
  const consecutiveIdenticalSignatures: Array<[number, number, string]> = [];

  for (let i = 1; i < data.screens.length; i += 1) {
    const previous = data.screens[i - 1];
    const current = data.screens[i];
    if (!previous || !current) continue;
    const previousHasContent = previous.encounters.length > 0 || previous.hazards.length > 0;
    const currentHasContent = current.encounters.length > 0 || current.hazards.length > 0;
    if (previousHasContent && currentHasContent && previous.signature === current.signature) {
      consecutiveIdenticalSignatures.push([previous.id, current.id, current.signature]);
    }
  }

  let longestNearFlatRun = 0;
  let nearFlatRun = 0;
  for (const screen of data.screens) {
    if (screen.surfaceHeight.verticalVariationRows === 0) {
      nearFlatRun += 1;
      longestNearFlatRun = Math.max(longestNearFlatRun, nearFlatRun);
    } else {
      nearFlatRun = 0;
    }
  }

  return {
    totalScreens: data.mainRouteScreenIds.length,
    traversalPixels: data.routeNodes.slice(1).reduce((sum, node, i) => {
      const previous = data.routeNodes[i];
      if (!previous) return sum;
      return (
        sum +
        Math.abs(node.worldPosition.x - previous.worldPosition.x) +
        Math.abs(node.worldPosition.y - previous.worldPosition.y)
      );
    }, 0),
    verticalScreens,
    verticalPathPct: (verticalScreens / data.mainRouteScreenIds.length) * 100,
    macroDirectionChanges: countChanges(data.macroBeatDirections),
    macroLongestRun: longestRun(data.macroBeatDirections),
    screenDirectionChanges: countChanges(screenDirections),
    screenLongestRun: longestRun(screenDirections),
    longestNearFlatRun,
    encounterDensityScreensPerEncounter: data.mainRouteScreenIds.length / encounters,
    consecutiveIdenticalSignatures,
    maxMandatoryGapTiles: Math.max(...data.screens.map((screen) => screen.maxMandatoryGapTiles)),
  };
}

export function verifyFoundryStage(data: StageVerificationData): StageVerificationMetrics {
  const metrics = calculateStageVerificationMetrics(data);
  const expectedRoute = data.mainRouteScreenIds;
  if (data.routeNodes.length !== expectedRoute.length + 1)
    throw new Error('route node count mismatch');
  for (const [i, node] of data.routeNodes.entries()) {
    if (node.sequenceIndex !== i) throw new Error('route node ordering mismatch');
    if (i > 0 && node.screenIndex !== expectedRoute[i - 1])
      throw new Error('route node ordering mismatch');
    if (!node.baseKitTraversalValid) throw new Error(`route node ${node.id} is not base-kit valid`);
  }
  if (data.dominantAxis !== 'vertical') throw new Error('Foundry must declare vertical axis');
  if (
    metrics.totalScreens < data.targetTraversalScreens.min ||
    metrics.totalScreens > data.targetTraversalScreens.max
  ) {
    throw new Error(`screen count ${metrics.totalScreens} outside target`);
  }
  if (
    metrics.traversalPixels < data.targetTraversalPixels.min ||
    metrics.traversalPixels > data.targetTraversalPixels.max
  ) {
    throw new Error(`traversal ${metrics.traversalPixels}px outside target`);
  }
  if (metrics.verticalPathPct < data.verticalPathTargetPct)
    throw new Error('vertical path below target');
  if (metrics.macroDirectionChanges < 4) throw new Error('macro direction changes below target');
  if (metrics.screenLongestRun > 3 || metrics.macroLongestRun > 3)
    throw new Error('direction run exceeds 3');
  if (metrics.longestNearFlatRun > 3) throw new Error('near-flat terrain run exceeds 3');
  if (!data.branch.connectedToMainRoute || data.branch.requiresDash)
    throw new Error('branch/rejoin invalid');
  if (
    !data.mainRouteScreenIds.includes(data.branch.forkScreen) ||
    !data.mainRouteScreenIds.includes(data.branch.rejoinScreen)
  ) {
    throw new Error('branch fork/rejoin missing from main route');
  }
  if (data.structuralElements.ascentShaft.screens.length < 2)
    throw new Error('ascent shaft missing');
  if (!data.structuralElements.controlledDescent.steerable)
    throw new Error('controlled descent not steerable');
  if (!data.structuralElements.controlledDescent.visibleLandingHalfScreenBeforeCommitment) {
    throw new Error('controlled descent landing visibility missing');
  }
  if (!data.structuralElements.controlledDescent.noBlindLandingOntoHazard) {
    throw new Error('controlled descent blind hazard landing');
  }
  if (data.structuralElements.controlledDescent.slowfallPushY >= 0)
    throw new Error('slowfall assist must oppose falling');
  if (data.structuralElements.controlledDescent.maxFallSpeedY <= 0)
    throw new Error('controlled descent max fall speed must be positive');
  if (
    !data.structuralElements.multiFloorRoom.genuineLayerChoice ||
    data.structuralElements.multiFloorRoom.selectableFloors.length < 3
  ) {
    throw new Error('multi-floor layer choice missing');
  }
  if (
    metrics.encounterDensityScreensPerEncounter < 1.5 ||
    metrics.encounterDensityScreensPerEncounter > 2
  ) {
    throw new Error('encounter density outside target');
  }
  if (metrics.consecutiveIdenticalSignatures.length > 0)
    throw new Error('consecutive identical signatures');
  const introducedTogether = new Map<string, Set<string>>();
  for (const intro of data.hazardIntroductions) {
    const hazards = introducedTogether.get(intro.beat) ?? new Set<string>();
    hazards.add(intro.hazard);
    introducedTogether.set(intro.beat, hazards);
  }
  for (const hazards of introducedTogether.values()) {
    if (hazards.size > 1) throw new Error('multiple hazards introduced in one beat');
  }
  if (metrics.maxMandatoryGapTiles > 3) throw new Error('mandatory gap exceeds base kit');
  if (data.checkpoints.length !== 4) throw new Error('Foundry must have four checkpoints');
  return metrics;
}
