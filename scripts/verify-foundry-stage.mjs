import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/stages/foundry-verification.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('src/data/stages/foundry.json', 'utf8'));
const objectLayers = Object.fromEntries(
  map.layers
    .filter((layer) => layer.type === 'objectgroup')
    .map((layer) => [layer.name, layer.objects]),
);
const entities = objectLayers.entities ?? [];
const checkpoints = objectLayers.checkpoints ?? [];
const routeMarkers = objectLayers.routeMarkers ?? [];
const sections = objectLayers.sections ?? [];
const groundLayer = map.layers.find(
  (layer) => layer.type === 'tilelayer' && layer.name === 'ground',
);
const tileAt = (col, row) => groundLayer?.data[row * map.width + col] ?? 0;
const isTopTile = (col, row) => tileAt(col, row) === 2;

const center = (object) => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 });
const property = (object, name) => object.properties?.find((item) => item.name === name)?.value;
const routeNodeObjects = routeMarkers
  .filter((object) => object.type === 'routeNode')
  .sort((a, b) => property(a, 'sequenceIndex') - property(b, 'sequenceIndex'));
const nodeDistance = (a, b) =>
  Math.abs(center(a).x - center(b).x) + Math.abs(center(a).y - center(b).y);
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
const traversalPixels = routeNodeObjects
  .slice(1)
  .reduce((sum, node, i) => sum + nodeDistance(routeNodeObjects[i], node), 0);
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

assert(map.width === 368 && map.height === 285, 'map dimensions changed unexpectedly');
assert(
  entities.some((object) => object.type === 'playerSpawn'),
  'player spawn missing',
);
assert(
  entities.some((object) => object.type === 'bossDoor'),
  'boss door missing',
);
assert(
  sections.some((object) => object.name === 'finalExam'),
  'finalExam section missing',
);
assert(
  routeMarkers.some((object) => object.type === 'bossEntry'),
  'bossEntry marker missing',
);
assert(routeNodeObjects.length === data.routeNodes.length, 'map routeNode count mismatch');
for (const [i, object] of routeNodeObjects.entries()) {
  const claimed = data.routeNodes[i];
  assert(Boolean(claimed), `metadata route node missing for map route index ${i}`);
  if (claimed) {
    const c = center(object);
    assert(claimed.id === object.name, `route marker name mismatch at index ${i}`);
    assert(
      claimed.worldPosition.x === c.x && claimed.worldPosition.y === c.y,
      `metadata/map position mismatch for ${object.name}`,
    );
    assert(
      claimed.sequenceIndex === property(object, 'sequenceIndex'),
      `sequence property mismatch for ${object.name}`,
    );
  }
}
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
assert(data.routeNodes.length === data.mainRouteScreenIds.length + 1, 'route node count mismatch');
assert(
  data.routeNodes.every(
    (node, i) =>
      node.sequenceIndex === i && (i === 0 || node.screenIndex === data.mainRouteScreenIds[i - 1]),
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
const metadataPickupCount = data.screens.reduce((sum, screen) => sum + screen.pickups.length, 0);
assert(metadataPickupCount >= 8, 'pickup count below target');
assert(metadataPickupCount <= 12, 'pickup count above target');
assert(maxGap <= 3, 'mandatory gap exceeds base kit');
assert(checkpoints.length === 4 && data.checkpoints.length === 4, 'checkpoint count invalid');
for (const checkpoint of data.checkpoints) {
  assert(
    checkpoints.some(
      (object) => object.name === checkpoint.id && property(object, 'order') === checkpoint.order,
    ),
    `checkpoint mismatch: ${checkpoint.id}`,
  );
}
const pickupObjects = entities.filter((object) =>
  ['energyPickup', 'heartChip', 'cellPack'].includes(object.type),
);
assert(
  pickupObjects.length === data.screens.reduce((sum, screen) => sum + screen.pickups.length, 0),
  'pickup metadata/map count mismatch',
);

const postMidbossCheckpoint = checkpoints.find(
  (object) => object.name === 'checkpoint-post-midboss',
);
assert(Boolean(groundLayer), 'ground tile layer missing');
assert(Boolean(postMidbossCheckpoint), 'post-midboss checkpoint missing');
if (groundLayer && postMidbossCheckpoint) {
  const checkpointCol = Math.floor(center(postMidbossCheckpoint).x / map.tilewidth);
  const checkpointFootRow = Math.floor(
    (postMidbossCheckpoint.y + postMidbossCheckpoint.height) / map.tileheight,
  );
  const continuationCols = Array.from({ length: 15 }, (_, i) => checkpointCol + 18 + i);
  const missingContinuationCols = continuationCols.filter(
    (col) => !isTopTile(col, checkpointFootRow),
  );
  assert(
    missingContinuationCols.length === 0,
    `post-midboss transition landing missing at cols ${missingContinuationCols.join(',')}`,
  );

  const upperLandingCols = Array.from({ length: 8 }, (_, i) => checkpointCol + 11 + i);
  const hasUpperLanding = upperLandingCols.some((col) => isTopTile(col, checkpointFootRow - 12));
  assert(hasUpperLanding, 'post-midboss transition upper landing missing for base-kit ascent');

  const transitionVent = entities.find(
    (object) => object.name === 'heatVent-post-midboss-recovery',
  );
  assert(Boolean(transitionVent), 'post-midboss transition heat vent missing');
  if (transitionVent) {
    assert(
      property(transitionVent, 'pushY') < 0,
      'post-midboss transition heat vent must assist upward movement',
    );
  }
}

console.log(
  'Pickup objects:',
  pickupObjects.map((object) => `${object.id}:${object.name}:${object.type}`).join(', '),
);
console.log(
  'Hazard introductions:',
  data.hazardIntroductions
    .map((intro) => `${intro.hazard}@screen${intro.screen}/${intro.beat}`)
    .join(', '),
);
console.log('Traversal metric: Manhattan polyline distance over ordered Tiled routeNode markers');
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
  ['pickupCount', String(metadataPickupCount), '8-12'],
  ['maxGapTiles', String(maxGap), '<=3'],
];
console.table(rows.slice(1).map(([metric, value, target]) => ({ metric, value, target })));
if (failures.length > 0) {
  console.error('Foundry verification FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Foundry verification PASSED');
