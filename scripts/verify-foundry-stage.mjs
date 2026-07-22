import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/stages/foundry-verification.json', 'utf8'));
const isVertical = (direction) => ['U', 'D', 'UP', 'DOWN'].includes(direction);
const changes = (directions) =>
  directions.slice(1).filter((direction, i) => direction !== directions[i]).length;
const longestRun = (directions) => {
  let run = 1;
  let longest = directions.length ? 1 : 0;
  for (let i = 1; i < directions.length; i += 1) {
    if (directions[i] === directions[i - 1]) longest = Math.max(longest, ++run);
    else run = 1;
  }
  return longest;
};

const screenDirections = data.screens.map((screen) => screen.movement);
const totalScreens = data.mainRouteScreenIds.length;
const traversalPixels = data.routeNodes.reduce((sum, node) => sum + node.segmentLengthPx, 0);
const verticalScreens = screenDirections.filter(isVertical).length;
const encounters = data.screens.reduce((sum, screen) => sum + screen.encounters.length, 0);
let nearFlatRun = 0;
let longestNearFlatRun = 0;
for (const screen of data.screens) {
  if (screen.surfaceHeight.verticalVariationRows === 0)
    longestNearFlatRun = Math.max(longestNearFlatRun, ++nearFlatRun);
  else nearFlatRun = 0;
}
const maxGap = Math.max(...data.screens.map((screen) => screen.maxMandatoryGapTiles));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(data.dominantAxis === 'vertical', 'dominant axis must be vertical');
assert(
  totalScreens >= data.targetTraversalScreens.min &&
    totalScreens <= data.targetTraversalScreens.max,
  'screen count outside target',
);
assert(
  traversalPixels >= data.targetTraversalPixels.min &&
    traversalPixels <= data.targetTraversalPixels.max,
  'traversal pixels outside target',
);
assert(
  (verticalScreens / totalScreens) * 100 >= data.verticalPathTargetPct,
  'vertical path below target',
);
assert(changes(data.macroBeatDirections) >= 4, 'macro direction changes below target');
assert(
  longestRun(screenDirections) <= 3 && longestRun(data.macroBeatDirections) <= 3,
  'same-direction run exceeds target',
);
assert(longestNearFlatRun <= 3, 'near-flat run exceeds target');
assert(data.routeNodes.length === data.mainRouteScreenIds.length, 'route node count mismatch');
assert(
  data.routeNodes.every(
    (node, i) => node.sequenceIndex === i + 1 && node.screenIndex === data.mainRouteScreenIds[i],
  ),
  'route node ordering mismatch',
);
assert(
  data.routeNodes.every((node) => node.baseKitTraversalValid),
  'route node base-kit validity failed',
);
assert(data.branch.connectedToMainRoute && !data.branch.requiresDash, 'branch/rejoin invalid');
assert(
  data.branch.upperExpectedCompletionSeconds < data.branch.lowerExpectedCompletionSeconds,
  'upper branch must be faster than lower branch',
);
assert(data.structuralElements.ascentShaft.screens.length >= 2, 'ascent shaft missing');
assert(data.structuralElements.controlledDescent.steerable, 'controlled descent not steerable');
assert(
  data.structuralElements.controlledDescent.visibleLandingHalfScreenBeforeCommitment,
  'controlled descent landing visibility missing',
);
assert(
  data.structuralElements.controlledDescent.noBlindLandingOntoHazard,
  'controlled descent blind landing hazard',
);
assert(
  data.structuralElements.controlledDescent.maxFallSpeedY > 0,
  'controlled descent max fall speed invalid',
);
assert(data.structuralElements.multiFloorRoom.genuineLayerChoice, 'multi-floor choice missing');
assert(
  totalScreens / encounters >= 1.5 && totalScreens / encounters <= 2,
  'encounter density outside target',
);
assert(
  data.screens.reduce((sum, screen) => sum + screen.pickups.length, 0) >= 8,
  'pickup count below target',
);
assert(maxGap <= 3, 'mandatory gap exceeds base kit');
assert(data.checkpoints.length === 4, 'checkpoint count invalid');

const rows = [
  ['metric', 'value', 'target'],
  ['dominantAxis', data.dominantAxis, 'vertical'],
  ['screens', String(totalScreens), '28-36'],
  ['traversalPx', String(traversalPixels), '9000-11500'],
  [
    'verticalPct',
    ((verticalScreens / totalScreens) * 100).toFixed(2),
    `>=${data.verticalPathTargetPct}`,
  ],
  ['macroChanges', String(changes(data.macroBeatDirections)), '>=4'],
  ['screenLongestRun', String(longestRun(screenDirections)), '<=3'],
  ['nearFlatRun', String(longestNearFlatRun), '<=3'],
  ['encounterDensity', (totalScreens / encounters).toFixed(2), '1.5-2'],
  [
    'pickupCount',
    String(data.screens.reduce((sum, screen) => sum + screen.pickups.length, 0)),
    '8-12',
  ],
  ['maxGapTiles', String(maxGap), '<=3'],
];
console.table(rows.slice(1).map(([metric, value, target]) => ({ metric, value, target })));
if (failures.length > 0) {
  console.error('Foundry verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Foundry verification PASSED');
