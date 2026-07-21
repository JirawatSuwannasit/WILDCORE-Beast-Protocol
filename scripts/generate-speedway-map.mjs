// Generator for Speedway Savanna's Tiled JSON map (GDD §2.6/§2.7/§3.1,
// M2-AUDIT-REBUILD, then re-audited against the axis-flexible §2.6/§3.1
// revision). Speedway predates §2.7 and was always hand-authored JSON (no
// generator ever existed for it, unlike Reservoir's
// generate-reservoir-map.mjs).
//
// DECLARED AXIS: HORIZONTAL-DOMINANT (GDD §3.1: "the counterpoint to
// Reservoir's vertical descent... a tall ascent shaft is NOT required
// here - keep the pace horizontal"). Under the axis-flexible rule,
// horizontal-dominant stages target >=20% vertical path (not 35%) and
// pick 2 of the 3 structural elements to fit their theme instead of all
// three being forced. Speedway uses DESCENT (the boost-strip setpiece)
// + MULTI-FLOOR (the highway underpass breather) - no mandatory ascent
// shaft. A single short wall-kick leg is kept in finalExam purely as
// texture ("short wall-kick climbs are fine as texture" - GDD §3.1),
// not counted as a structural element.
//
// The anti-corridor floor rule (no >3 consecutive same-direction
// screens, >=4 direction changes, surface not a monotonic slope) and the
// BRANCH & REJOIN rule (mandatory for every stage regardless of axis)
// still apply in full - re-verified below, not relaxed just because the
// vertical floor dropped.
//
// This generator re-authors the ground layer from scratch using the same
// screen-shape-primitive + mechanical validation discipline Reservoir's
// M4.1-REBUILD-2/3 established, kept DISTINCT from Reservoir's shape per
// the prompt (no water, no valves - speed strips / electric fences /
// collapsing bridges / patrol drones / turret sunflowers / spark bugs,
// high-speed horizontal with elevation spikes rather than a deep
// vertical descent). The existing boss, enemy/hazard roster, checkpoint
// count/order, and 9-beat structure are kept; only the terrain and route
// shape change.

import fs from 'node:fs';

const TILE = 16;
const H_COLS = 20; // horizontal screen width, tiles (320px, GDD §2.6's native-view screen)
const V_COLS = 12; // vertical screen width/height unit, tiles (192px, native-view height)
const FILL_DEPTH = 10;
const EMPTY = 0;
const FILL = 1; // GID 1: bulk fill tile
const TOP = 2; // GID 2: floor-top tile

// Base-kit jump-reach ceilings (see DECISIONS.md "Bugfix - Speedway gaps
// exceeding base-kit jump reach"): a flat-ground jump maxes out at
// ~3.97 tiles, a wall-kick burst at ~4.28 tiles. Every VOID gap (a real
// hole in the ground, where the only way to trigger a jump is to keep
// running until the floor ends - naturally anchoring takeoff right at
// the edge) stays at or under 3 tiles (48px, ~30-40% margin) - proven
// safe in that bugfix, reused verbatim rather than re-derived.
const SAFE_GAP_TILES = 3;
// Lethal ground hazards (spikes) are a NARROWER case: they sit on
// otherwise-continuous solid ground, so nothing forces the player to
// jump right at the hazard's edge the way a void gap does - a player who
// jumps even ~20-40px too early (a normal reaction, not a mistake) burns
// flight distance before ever reaching the hazard and can land short,
// INSIDE it, which is instant death rather than a recoverable short
// fall. Live Playwright testing (teleport-and-jump at controlled
// distances before the hazard, holding to a full max-height jump) found
// a 3-tile (48px) spike patch fails even a reasonably-timed jump (~18px
// early), while 2 tiles (32px) survives every timing up to ~16px early
// and is what 3 of the 4 spike placements already used - narrowed the
// one 3-tile outlier to match. See DECISIONS.md for the full writeup.
const SAFE_SPIKE_TILES = 2;

// --- Sparse grid -----------------------------------------------------------
const cells = new Map();
function setTile(col, row, gid) {
  cells.set(`${row},${col}`, gid);
}
function fillFloor(colStart, colEnd, row, depth = FILL_DEPTH) {
  for (let c = colStart; c < colEnd; c += 1) {
    setTile(c, row, TOP);
    for (let d = 1; d <= depth; d += 1) setTile(c, row + d, FILL);
  }
}
function fillWall(colStart, colEnd, rowStart, rowEnd) {
  for (let c = colStart; c < colEnd; c += 1) {
    for (let r = rowStart; r <= rowEnd; r += 1) setTile(c, r, FILL);
  }
}
function fillLedge(colStart, colEnd, row) {
  fillFloor(colStart, colEnd, row, 3);
}

// --- Screen-shape sequence -------------------------------------------------
// `dir` drives the GDD §2.6 axis-mix/run-length/direction-change stats;
// `motif` is the §2.7 content-variety axis - the actual ground SHAPE used,
// tracked separately so distinct-looking screens (e.g. a gentle ascending
// staircase vs. a wall-kick shaft) aren't conflated just because both
// happen to be tagged 'U'.
const PLAN = [
  // Beat 1: Intro (3) - safe, sells the theme, ends on a small themed rise.
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'stairAscent' },
  // Beat 2: Gimmick tutorial (5) - speed strip debuts harmless (flat, no
  // enemies pressuring it), then a readable dip and a small safe gap.
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'stairDescent' },
  { dir: 'R', motif: 'gap' },
  { dir: 'R', motif: 'flat' },
  // Beat 3: Escalation (5) - BRANCH & REJOIN at the turbine tower (upper
  // blade-platform route / lower fence corridor), spikes debut post-rejoin.
  { dir: 'U', motif: 'stairAscent' },
  { dir: 'R', motif: 'branch' },
  { dir: 'R', motif: 'branch' },
  { dir: 'D', motif: 'stairDescent' },
  { dir: 'R', motif: 'flat' },
  // Beat 4: Mid-boss (1) - twin patrol drones circling the pylon -> checkpoint.
  { dir: 'R', motif: 'flat' },
  // Beat 5: Remix (6) - horizontal-dominant: no ascent shaft here (that's
  // not one of Speedway's 2 declared structural elements). Fast, mostly
  // flat plateau screens with the collapsing-bridge debut (a REAL gap
  // spanned by a temporary tile, not decorative), a plain gap for ground-
  // shape variety, and one short dip + rise (the flavor text's "elevation
  // spikes") purely to satisfy the anti-corridor no->3-same-direction
  // floor rule (still mandatory regardless of axis) - not a structural
  // ascent shaft.
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'stairDescent' },
  { dir: 'R', motif: 'bridgeGap' },
  { dir: 'R', motif: 'gap' },
  { dir: 'U', motif: 'stairAscent' },
  { dir: 'R', motif: 'flat' },
  // Beat 6: Setpiece (5) - high-speed downhill BOOST-STRIP DESCENT, staged
  // wide landings (distinct rhythm from the tutorial/escalation stair).
  { dir: 'D', motif: 'boostDescent' },
  { dir: 'D', motif: 'boostDescent' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'boostDescent' },
  { dir: 'D', motif: 'sheerDescent' },
  // Beat 7: Breather (3) - MULTI-FLOOR highway underpass (2 real screens,
  // 3 shallow stacked road/drainage decks - the stage's other declared
  // structural element), Legs Capsule off the lowest (least obvious)
  // deck via a wall-kick chain.
  { dir: 'D', motif: 'multiFloor' },
  { dir: 'R', motif: 'multiFloor' },
  { dir: 'R', motif: 'flat' },
  // Beat 8: Final exam (5) - hardest COMBINATION: gap+spikes+drone, a
  // wall-kick reprise, the full hazard roster together, a stair drop.
  { dir: 'R', motif: 'gap' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'stairDescent' },
  { dir: 'R', motif: 'flat' },
  // Beat 9: Pre-boss (2) - energy pickups -> checkpoint -> boss room. A
  // small safe dip (no hazards) rather than pure flat - the tail end of
  // the stage otherwise sits at one elevation for too many consecutive
  // REAL (320px) screens once the shaft is gone from remix.
  { dir: 'D', motif: 'stairDescent' },
  { dir: 'R', motif: 'flat' },
];

const SEQUENCE = PLAN.map((p) => p.dir);
const MOTIFS = PLAN.map((p) => p.motif);

const BEATS = [
  { name: 'intro', count: 3 },
  { name: 'tutorial', count: 5 },
  { name: 'escalation', count: 5 },
  { name: 'midboss', count: 1 },
  { name: 'remix', count: 6 },
  { name: 'setpiece', count: 5 },
  { name: 'breather', count: 3 },
  { name: 'finalExam', count: 5 },
  { name: 'preboss', count: 2 },
];

if (SEQUENCE.length !== BEATS.reduce((a, b) => a + b.count, 0)) {
  throw new Error('SEQUENCE length does not match BEATS budget');
}

const screenToBeat = [];
{
  let idx = 0;
  BEATS.forEach((b, bi) => {
    for (let i = 0; i < b.count; i += 1) screenToBeat[idx++] = bi + 1;
  });
}

// --- Route-shape validation (GDD §2.6) --------------------------------------
function validateRouteShape(sequence) {
  const total = sequence.length;
  const vertical = sequence.filter((t) => t === 'U' || t === 'D').length;
  const verticalPct = (vertical / total) * 100;
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < sequence.length; i += 1) {
    if (sequence[i] === sequence[i - 1]) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else {
      run = 1;
    }
  }
  let changes = 0;
  for (let i = 1; i < sequence.length; i += 1) if (sequence[i] !== sequence[i - 1]) changes += 1;
  return { total, vertical, verticalPct, maxRun, changes };
}
const stats = validateRouteShape(SEQUENCE);
console.log('Route-shape stats (direction):', stats);
// Horizontal-dominant axis target (GDD §2.6 axis-flexible rule): >=20%,
// not the 35% vertical-dominant floor Reservoir uses.
const VERTICAL_PCT_FLOOR = 20;
if (stats.total < 28 || stats.total > 36)
  throw new Error(`screen count ${stats.total} outside 28-36`);
if (stats.verticalPct < VERTICAL_PCT_FLOOR)
  throw new Error(
    `vertical% ${stats.verticalPct} below the horizontal-dominant floor of ${VERTICAL_PCT_FLOOR}`,
  );
if (stats.maxRun > 3) throw new Error(`max same-direction run ${stats.maxRun} exceeds 3`);
if (stats.changes < 4) throw new Error(`direction changes ${stats.changes} below 4`);

// --- Motif-repetition validation (GDD §2.7: no repeated ledge/gap motif) ---
function validateMotifRuns(motifs) {
  let maxRun = 1;
  let run = 1;
  let worstStart = 0;
  for (let i = 1; i < motifs.length; i += 1) {
    if (motifs[i] === motifs[i - 1]) {
      run += 1;
      if (run > maxRun) {
        maxRun = run;
        worstStart = i - run + 1;
      }
    } else {
      run = 1;
    }
  }
  return { maxRun, worstStart };
}
const motifStats = validateMotifRuns(MOTIFS);
console.log('Motif-repetition check:', motifStats, 'distinct motifs used:', [...new Set(MOTIFS)]);
if (motifStats.maxRun > 3) {
  throw new Error(
    `motif "${MOTIFS[motifStats.worstStart]}" repeats ${motifStats.maxRun}x consecutively (screens ${motifStats.worstStart + 1}-${motifStats.worstStart + motifStats.maxRun}) - exceeds the 3-screen cap`,
  );
}

// --- Screen-by-screen authoring: ground-shape primitives --------------------
const cursor = { col: 0, row: 40 };
const segments = [];
let objectId = 1;
const nextId = () => objectId++;

function screenR(colEnd, row) {
  fillFloor(cursor.col, colEnd, row);
  const seg = { colStart: cursor.col, colEnd, row, rowEnter: row, rowExit: row };
  cursor.col = colEnd;
  return seg;
}

/** motif 'gap': flat floor split by one SAFE_GAP_TILES-wide pit - a highway with a broken section, not a descent. */
function screenRGap(colEnd, row, gapTiles = SAFE_GAP_TILES) {
  const gapStart = cursor.col + Math.floor((colEnd - cursor.col) / 2) - Math.floor(gapTiles / 2);
  const gapEnd = gapStart + gapTiles;
  fillFloor(cursor.col, gapStart, row);
  fillFloor(gapEnd, colEnd, row);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row,
    rowEnter: row,
    rowExit: row,
    gap: { left: gapStart, right: gapEnd },
  };
  cursor.col = colEnd;
  return seg;
}

/**
 * motif 'bridgeGap': flat floor split by a REAL SAFE_GAP_TILES-wide pit,
 * distinct from plain 'gap' - the pit has no ground tile under it at all
 * (unlike the old hand-authored map, which placed collapsingBridge hazard
 * objects decoratively on top of already-solid ground, so the "collapse"
 * never actually mattered). The generator only builds the ground shape
 * here; the caller adds the collapsingBridge hazard object spanning the
 * gap, which is a real solid platform in its own right (see
 * CollapsingBridgeTile - a standalone static body, not tied to the
 * ground tile layer) that disables itself for a while after being
 * triggered.
 */
function screenRBridge(colEnd, row) {
  const gapStart =
    cursor.col + Math.floor((colEnd - cursor.col) / 2) - Math.floor(SAFE_GAP_TILES / 2);
  const gapEnd = gapStart + SAFE_GAP_TILES;
  fillFloor(cursor.col, gapStart, row);
  fillFloor(gapEnd, colEnd, row);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row,
    rowEnter: row,
    rowExit: row,
    gap: { left: gapStart, right: gapEnd },
  };
  cursor.col = colEnd;
  return seg;
}

/** motif 'stairDescent': solid 4-step staircase, no gaps - controlled, readable landings. */
function screenDStair(colEnd, rowStart) {
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  // Backstops start at their OWN floor's row, not several tiles above it -
  // a wall starting higher than the row the player is already standing on
  // blocks the flat walk-in entirely (Arcade collision doesn't distinguish
  // FILL from TOP). See Reservoir's M4.1-REBUILD-2 for the bug this avoids.
  fillWall(cursor.col, cursor.col + 1, rowStart, wallBottom);
  fillWall(colEnd - 1, colEnd, rowEnd, wallBottom);
  const innerStart = cursor.col + 1;
  const innerEnd = colEnd - 1;
  const stepCols = Math.floor((innerEnd - innerStart) / 4);
  const stepRows = V_COLS / 4;
  let col = innerStart;
  let row = rowStart;
  const treads = [];
  for (let i = 0; i < 4; i += 1) {
    row += stepRows;
    const segEnd = i === 3 ? innerEnd : col + stepCols;
    fillFloor(col, segEnd, row, FILL_DEPTH);
    treads.push({ col: (col + segEnd) / 2, row });
    col = segEnd;
  }
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    treads,
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

/** motif 'stairAscent': the mirror of stairDescent - a gentle climbing staircase, no wall-kick required. */
function screenUStair(colEnd, rowStart) {
  const rowEnd = rowStart - V_COLS;
  const wallBottom = rowStart + FILL_DEPTH;
  // Backstops start at their OWN floor's row (rowStart for the entry
  // column, rowEnd for the exit column) and only extend DOWN through
  // wallBottom - never up above the row the player is standing on. A
  // backstop spanning up to some higher "wallTop" would put solid fill
  // directly in the flat walk-in's headroom, blocking entry entirely
  // (the same bug class fixed repeatedly in Reservoir's rebuilds - see
  // screenDStair's comment). Mirrors stairDescent's entry/exit walls
  // exactly, just with rowStart/rowEnd swapped for the climb direction.
  fillWall(cursor.col, cursor.col + 1, rowStart, wallBottom);
  fillWall(colEnd - 1, colEnd, rowEnd, wallBottom);
  const innerStart = cursor.col + 1;
  const innerEnd = colEnd - 1;
  const stepCols = Math.floor((innerEnd - innerStart) / 4);
  const stepRows = V_COLS / 4;
  let col = innerStart;
  let row = rowStart;
  const treads = [];
  for (let i = 0; i < 4; i += 1) {
    const segEnd = i === 3 ? innerEnd : col + stepCols;
    fillFloor(col, segEnd, row, FILL_DEPTH);
    treads.push({ col: (col + segEnd) / 2, row });
    col = segEnd;
    row -= stepRows;
  }
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    treads,
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

/** motif 'sheerDescent': entry -> one 8-tile fall -> a mid ledge -> a 4-tile fall to the floor. Steeper, fewer stops than the stair. */
function screenDSheer(colEnd, rowStart) {
  const rowMid = rowStart + 8;
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  fillWall(cursor.col, cursor.col + 2, rowStart, wallBottom);
  fillWall(colEnd - 2, colEnd, rowEnd, wallBottom);
  fillLedge(cursor.col + 2, cursor.col + 7, rowMid);
  fillFloor(colEnd - 2, colEnd, rowEnd);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    ledge1: { col: cursor.col + 4, row: rowMid },
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

/** motif 'boostDescent': TWO wide treads (not stair's four narrow ones) - long enough to plant a full speed-strip run on each, a distinctly different downhill rhythm. */
function screenDBoost(colEnd, rowStart) {
  const rowMid = rowStart + 6;
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  fillWall(cursor.col, cursor.col + 2, rowStart, wallBottom);
  fillWall(colEnd - 2, colEnd, rowEnd, wallBottom);
  const midCol = cursor.col + Math.floor((colEnd - cursor.col) / 2) + 1;
  fillFloor(cursor.col + 2, midCol, rowMid, FILL_DEPTH);
  fillFloor(midCol, colEnd - 2, rowEnd, FILL_DEPTH);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    tread1: { colStart: cursor.col + 2, colEnd: midCol, row: rowMid },
    tread2: { colStart: midCol, colEnd: colEnd - 2, row: rowEnd },
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

/** motif 'shaft': wall-kick ascent leg, 3-tile gap (proven-safe width, see DECISIONS.md). */
function screenUShaft(colEnd, rowStart) {
  const rowEnd = rowStart - V_COLS;
  const wallTop = rowEnd - 4;
  const wallBottom = rowStart + FILL_DEPTH;
  const gapWidth = SAFE_GAP_TILES;
  const midCol = cursor.col + Math.floor((colEnd - cursor.col) / 2);
  // leftWallEnd/rightWallStart must be exactly gapWidth tiles apart - using
  // Math.ceil(gapWidth / 2) on BOTH sides (as an earlier draft did) rounds
  // an odd gapWidth=3 up to a 4-tile (64px) real gap, dangerously close to
  // the ~68.5px wall-kick reach ceiling with none of the proven-safe 48px
  // margin (see DECISIONS.md's base-kit jump-reach bugfix). Anchored off
  // one side only so the gap is exactly gapWidth tiles, no rounding.
  const leftWallEnd = midCol - Math.floor(gapWidth / 2);
  const rightWallStart = leftWallEnd + gapWidth;
  fillWall(cursor.col, leftWallEnd, wallTop, wallBottom);
  fillWall(rightWallStart, colEnd, wallTop, wallBottom);
  fillFloor(cursor.col, leftWallEnd, rowStart);
  fillFloor(rightWallStart, colEnd, rowEnd);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    gap: { left: leftWallEnd, right: rightWallStart },
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

// --- Object layers -----------------------------------------------------
const checkpointObjects = [];
const entityObjects = [];
const hazardObjects = [];
const sectionObjects = [];

function addEntity(type, name, x, y, w, h, properties = []) {
  entityObjects.push({
    id: nextId(),
    type,
    name,
    x: x - w / 2,
    y: y - h / 2,
    width: w,
    height: h,
    visible: true,
    properties,
  });
}
function addHazard(type, name, x, y, w, h, properties = []) {
  hazardObjects.push({
    id: nextId(),
    type,
    name,
    x: x - w / 2,
    y: y - h / 2,
    width: w,
    height: h,
    visible: true,
    properties,
  });
}
function addCheckpoint(name, order, x, y) {
  checkpointObjects.push({
    id: nextId(),
    type: 'checkpoint',
    name,
    x: x - 8,
    y: y - 8,
    width: 16,
    height: 16,
    visible: true,
    properties: [{ name: 'order', type: 'int', value: order }],
  });
}
function addSection(name, colStart, colEnd, rowTop, rowBottom) {
  sectionObjects.push({
    id: nextId(),
    type: 'section',
    name,
    x: colStart * TILE,
    y: rowTop * TILE,
    width: (colEnd - colStart) * TILE,
    height: (rowBottom - rowTop) * TILE,
    visible: true,
    properties: [],
  });
}
function tileCenterX(col) {
  return col * TILE;
}
function rowTopY(row) {
  return row * TILE;
}
function standingY(row, entityHalfHeight = 8) {
  return row * TILE - entityHalfHeight;
}

// --- §2.7 content-signature tracking ---------------------------------------
const screenSignature = {};
function sig(n) {
  if (!screenSignature[n]) screenSignature[n] = { enemies: [], hazards: [], gimmicks: [] };
  return screenSignature[n];
}
function tagEnemy(n, type) {
  sig(n).enemies.push(type);
}
function tagHazard(n, type) {
  sig(n).hazards.push(type);
}
function tagGimmick(n, type) {
  sig(n).gimmicks.push(type);
}

// =====================================================================
// Beat 1: Intro (1-3)
// =====================================================================
addEntity('playerSpawn', 'playerSpawn', tileCenterX(2), standingY(cursor.row), 16, 16);
segments[1] = screenR(cursor.col + H_COLS, cursor.row);
addCheckpoint(
  'checkpoint-start',
  0,
  tileCenterX(segments[1].colStart + 2),
  standingY(segments[1].row),
);
addEntity(
  'sparkBug',
  'sparkBug-intro',
  tileCenterX(segments[1].colStart + 14),
  standingY(segments[1].row),
  16,
  16,
);
tagEnemy(1, 'sparkBug');

segments[2] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'energyPickup',
  'pickup-intro',
  tileCenterX(segments[2].colStart + 10),
  standingY(segments[2].row),
  16,
  16,
);

segments[3] = screenUStair(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 2: Gimmick tutorial (4-8) - speed strip debut (harmless, flat),
// a readable dip, a small safe gap.
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[4] = s;
  addHazard(
    'speedStrip',
    'speedStrip-tut-1',
    tileCenterX(s.colStart + 8),
    standingY(s.row),
    128,
    16,
  );
  tagGimmick(4, 'speedStrip');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[5] = s;
  addEntity(
    'patrolDrone',
    'patrolDrone-tut',
    tileCenterX(s.colStart + 10),
    rowTopY(s.row) - 40,
    16,
    16,
  );
  addEntity('energyPickup', 'pickup-tut', tileCenterX(s.colStart + 15), standingY(s.row), 16, 16);
  tagEnemy(5, 'patrolDrone');
}
segments[6] = screenDStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'sparkBug',
  'sparkBug-tut',
  tileCenterX(segments[6].treads[2].col),
  standingY(segments[6].treads[2].row),
  16,
  16,
);
tagEnemy(6, 'sparkBug');

segments[7] = screenRGap(cursor.col + H_COLS, cursor.row);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[8] = s;
  addEntity(
    'energyPickup',
    'pickup-tut-end',
    tileCenterX(s.colStart + 10),
    standingY(s.row),
    16,
    16,
  );
}

// =====================================================================
// Beat 3: Escalation (9-13) - BRANCH & REJOIN at the turbine tower:
// upper blade-platform route (risky + pickups, patrol drones, precision
// jumps) vs lower fence corridor (safe, continuous, electric fence
// debut), rejoining before the mid-boss. Spikes debut post-rejoin.
// =====================================================================
segments[9] = screenUStair(cursor.col + V_COLS, cursor.row);

let branchForkScreen;
let branchRejoinScreen;
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS * 2;
  // The player ARRIVES at the upper elevation - screen 9's stair climb
  // ends exactly here, so the first blade platform is reachable by
  // simply walking off the last tread, no jump required. The lower band
  // sits 9 rows (144px) BELOW arrival - always reachable by just falling
  // (dropping down is never a reachability problem) - never above it,
  // which would need an impossible flat-height jump to even start the
  // branch. 9 rows of separation is still enough that both read as
  // genuinely separate elevations in a single camera frame, matching
  // Reservoir's M4.1-REBUILD-3 branch-separation fix.
  const upperRow = cursor.row;
  const lowerRow = cursor.row + 9;

  // Lower band: continuous "fence corridor" floor across the full span -
  // the safe route. Entry backstop starts at upperRow (the highest solid
  // the entry column needs to back up) down through the lower floor.
  fillFloor(colStart, colEnd, lowerRow);
  fillWall(colStart, colStart + 2, upperRow, lowerRow + FILL_DEPTH);

  // Upper band: separate floating "blade platforms" (turbine blades),
  // each a real solid ledge, gapped by SAFE_GAP_TILES - risky because it
  // demands a chain of precise jumps, not one continuous floor. The band
  // stops short of colEnd, so a player still up top free-falls the
  // remaining stretch and lands on the lower band before the rejoin.
  const plat1Start = colStart + 2;
  const plat1End = plat1Start + 4;
  const plat2Start = plat1End + SAFE_GAP_TILES;
  const plat2End = plat2Start + 4;
  const plat3Start = plat2End + SAFE_GAP_TILES;
  const plat3End = plat3Start + 4;
  const plat4Start = plat3End + SAFE_GAP_TILES;
  const plat4End = plat4Start + 5;
  const upperBandEnd = colEnd - 12; // stops well short of colEnd -> forces the drop to rejoin
  fillLedge(plat1Start, Math.min(plat1End, upperBandEnd), upperRow);
  fillLedge(plat2Start, Math.min(plat2End, upperBandEnd), upperRow);
  fillLedge(plat3Start, Math.min(plat3End, upperBandEnd), upperRow);
  fillLedge(plat4Start, Math.min(plat4End, upperBandEnd), upperRow);

  addEntity(
    'patrolDrone',
    'patrolDrone-fork-upper-1',
    tileCenterX(plat2Start + 1),
    standingY(upperRow, 8),
    16,
    16,
  );
  addEntity(
    'patrolDrone',
    'patrolDrone-fork-upper-2',
    tileCenterX(plat4Start + 1),
    standingY(upperRow, 8),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-fork-upper-1',
    tileCenterX(plat1Start + 2),
    standingY(upperRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-fork-upper-2',
    tileCenterX(plat3Start + 2),
    standingY(upperRow),
    16,
    16,
  );

  addHazard(
    'electricFence',
    'electricFence-fork-lower-1',
    tileCenterX(colStart + 14),
    rowTopY(lowerRow) - 20,
    16,
    40,
  );
  addHazard(
    'electricFence',
    'electricFence-fork-lower-2',
    tileCenterX(colStart + 30),
    rowTopY(lowerRow) - 20,
    16,
    40,
  );
  addEntity(
    'sparkBug',
    'sparkBug-fork-lower',
    tileCenterX(colStart + 22),
    standingY(lowerRow),
    16,
    16,
  );

  segments[10] = {
    colStart,
    colEnd: colStart + H_COLS,
    row: lowerRow,
    rowEnter: lowerRow,
    rowExit: lowerRow,
    upperRow,
    lowerRow,
  };
  segments[11] = {
    colStart: colStart + H_COLS,
    colEnd,
    row: lowerRow,
    rowEnter: lowerRow,
    rowExit: lowerRow,
    upperRow,
    lowerRow,
  };
  cursor.col = colEnd;
  cursor.row = lowerRow;
  branchForkScreen = 10;
  branchRejoinScreen = 11;
  tagEnemy(10, 'patrolDrone');
  tagHazard(10, 'electricFence');
  tagEnemy(11, 'patrolDrone');
  tagHazard(11, 'electricFence');
  tagEnemy(11, 'sparkBug');
}

segments[12] = screenDStair(cursor.col + V_COLS, cursor.row);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[13] = s;
  addHazard(
    'spikes',
    'spikes-escalation',
    tileCenterX(s.colStart + 12),
    standingY(s.row, -2),
    SAFE_SPIKE_TILES * TILE,
    16,
  );
  addEntity(
    'turretSunflower',
    'turretSunflower-escalation',
    tileCenterX(s.colStart + 6),
    standingY(s.row),
    16,
    16,
  );
  tagHazard(13, 'spikes');
  tagEnemy(13, 'turretSunflower');
}

// =====================================================================
// Beat 4: Mid-boss arena (14) -> checkpoint. Twin patrol drones circling the pylon.
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[14] = s;
  const pylonCol = s.colStart + 10;
  addEntity('pylon', 'midBossPylon', tileCenterX(pylonCol), standingY(s.row, -4), 16, 40);
  addEntity(
    'patrolDrone',
    'patrolDrone-orbitA',
    tileCenterX(pylonCol),
    standingY(s.row, 40),
    16,
    16,
    [
      { name: 'orbitPylon', type: 'bool', value: true },
      { name: 'orbitAngleOffsetDeg', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'patrolDrone',
    'patrolDrone-orbitB',
    tileCenterX(pylonCol),
    standingY(s.row, 40),
    16,
    16,
    [
      { name: 'orbitPylon', type: 'bool', value: true },
      { name: 'orbitAngleOffsetDeg', type: 'int', value: 180 },
    ],
  );
  addCheckpoint('checkpoint-post-midboss', 1, tileCenterX(s.colEnd - 2), standingY(s.row));
}

// =====================================================================
// Beat 5: Remix (15-20) - horizontal-dominant: fast, mostly flat plateau
// screens. No ascent shaft (not one of Speedway's 2 declared structural
// elements - see the file header). The collapsing-bridge debut is a REAL
// gap now (see screenRBridge), not a decorative hazard sitting on solid
// ground.
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[15] = s;
  addEntity(
    'turretSunflower',
    'turretSunflower-remix-entry',
    tileCenterX(s.colStart + 6),
    standingY(s.row),
    16,
    16,
  );
  addEntity(
    'patrolDrone',
    'patrolDrone-remix-entry',
    tileCenterX(s.colStart + 14),
    rowTopY(s.row) - 40,
    16,
    16,
  );
  tagEnemy(15, 'turretSunflower');
}

segments[16] = screenDStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'sparkBug',
  'sparkBug-remix-dip',
  tileCenterX(segments[16].treads[2].col),
  standingY(segments[16].treads[2].row),
  16,
  16,
);
tagEnemy(16, 'sparkBug');

{
  const s = screenRBridge(cursor.col + H_COLS, cursor.row);
  segments[17] = s;
  addHazard(
    'collapsingBridge',
    'bridge-remix-1',
    tileCenterX((s.gap.left + s.gap.right) / 2),
    standingY(s.row),
    (s.gap.right - s.gap.left) * TILE,
    16,
  );
  addEntity('energyPickup', 'pickup-remix-1', tileCenterX(s.colEnd - 3), standingY(s.row), 16, 16);
  tagGimmick(17, 'collapsingBridge');
}

segments[18] = screenRGap(cursor.col + H_COLS, cursor.row);
addEntity(
  'patrolDrone',
  'patrolDrone-remix-gap',
  tileCenterX(segments[18].gap.left - 3),
  rowTopY(segments[18].row) - 40,
  16,
  16,
);
tagEnemy(18, 'patrolDrone');

segments[19] = screenUStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'turretSunflower',
  'turretSunflower-remix-2',
  tileCenterX(segments[19].treads[0].col),
  standingY(segments[19].treads[0].row),
  16,
  16,
);
addEntity(
  'patrolDrone',
  'patrolDrone-remix-2',
  tileCenterX(segments[19].treads[3].col),
  rowTopY(segments[19].treads[3].row) - 40,
  16,
  16,
);
tagEnemy(19, 'turretSunflower');
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[20] = s;
  addEntity('sparkBug', 'sparkBug-remix-2', tileCenterX(s.colStart + 8), standingY(s.row), 16, 16);
  addEntity(
    'energyPickup',
    'pickup-remix-2',
    tileCenterX(s.colStart + 14),
    standingY(s.row),
    16,
    16,
  );
  tagEnemy(20, 'sparkBug');
}

// =====================================================================
// Beat 6: Setpiece (21-25) - high-speed downhill BOOST-STRIP DESCENT
// (distinct from Reservoir's water descent): staged wide landings, a
// speed strip on every tread.
// =====================================================================
const descentRangeStart = 21;
segments[21] = screenDBoost(cursor.col + V_COLS, cursor.row);
addHazard(
  'speedStrip',
  'speedStrip-setpiece-1',
  tileCenterX(
    segments[21].tread1.colStart + (segments[21].tread1.colEnd - segments[21].tread1.colStart) / 2,
  ),
  standingY(segments[21].tread1.row),
  (segments[21].tread1.colEnd - segments[21].tread1.colStart) * TILE,
  16,
);
addEntity(
  'sparkBug',
  'sparkBug-setpiece-1',
  tileCenterX(segments[21].tread2.colStart + 2),
  standingY(segments[21].tread2.row),
  16,
  16,
);
tagGimmick(21, 'speedStrip');
tagEnemy(21, 'sparkBug');

segments[22] = screenDBoost(cursor.col + V_COLS, cursor.row);
addHazard(
  'speedStrip',
  'speedStrip-setpiece-2',
  tileCenterX(
    segments[22].tread2.colStart + (segments[22].tread2.colEnd - segments[22].tread2.colStart) / 2,
  ),
  standingY(segments[22].tread2.row),
  (segments[22].tread2.colEnd - segments[22].tread2.colStart) * TILE,
  16,
);
tagGimmick(22, 'speedStrip');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[23] = s;
  addHazard(
    'spikes',
    'spikes-setpiece',
    tileCenterX(s.colStart + 10),
    standingY(s.row, -2),
    SAFE_SPIKE_TILES * TILE,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-setpiece',
    tileCenterX(s.colStart + 15),
    standingY(s.row),
    16,
    16,
  );
  tagHazard(23, 'spikes');
}

segments[24] = screenDBoost(cursor.col + V_COLS, cursor.row);
addHazard(
  'speedStrip',
  'speedStrip-setpiece-3',
  tileCenterX(
    segments[24].tread1.colStart + (segments[24].tread1.colEnd - segments[24].tread1.colStart) / 2,
  ),
  standingY(segments[24].tread1.row),
  (segments[24].tread1.colEnd - segments[24].tread1.colStart) * TILE,
  16,
);
addEntity(
  'patrolDrone',
  'patrolDrone-descent',
  tileCenterX(segments[24].tread2.colStart + 2),
  rowTopY(segments[24].tread2.row) - 32,
  16,
  16,
);
tagGimmick(24, 'speedStrip');
tagEnemy(24, 'patrolDrone');

segments[25] = screenDSheer(cursor.col + V_COLS, cursor.row);
const descentRangeEnd = 25;
addCheckpoint(
  'checkpoint-post-setpiece',
  2,
  tileCenterX(segments[25].colEnd - 3),
  standingY(segments[25].row),
);

// =====================================================================
// Beat 7: Breather (26-28) - REAL multi-floor highway underpass: 2 real
// screens, 3 SHALLOW stacked road/drainage decks (not a tall room - each
// deck is only 6 rows/96px apart, so the whole structure stays as short
// as the old 2-deck version while adding a genuine middle layer). Player
// picks a layer via drop-through gaps; top and mid gaps are offset from
// each other so falling through the top always lands on solid mid floor
// first - a deliberate second choice, not a straight fall to the bottom.
// Legs Capsule off the LOWEST (least obvious) deck via a wall-kick chain.
// =====================================================================
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS * 2;
  const topRow = cursor.row;
  const midRow = topRow + 6;
  const botRow = topRow + V_COLS;
  // Entry/exit backstops start at their own floor's row, not above it -
  // same bug class fixed repeatedly in Reservoir's rebuilds.
  fillWall(colStart, colStart + 2, topRow, botRow + FILL_DEPTH);
  fillWall(colEnd - 2, colEnd, botRow, botRow + FILL_DEPTH);

  // Top deck: two drop-through gaps to the mid deck.
  const topGap1Start = colStart + 8;
  const topGap1End = topGap1Start + SAFE_GAP_TILES;
  const topGap2Start = colStart + 24;
  const topGap2End = topGap2Start + SAFE_GAP_TILES;
  fillFloor(colStart + 2, topGap1Start, topRow, 0);
  fillFloor(topGap1End, topGap2Start, topRow, 0);
  fillFloor(topGap2End, colEnd - 2, topRow, 0);

  // Mid deck: two drop-through gaps to the bottom deck, offset from the
  // top deck's gaps (falling through top always lands on solid mid).
  const midGap1Start = colStart + 15;
  const midGap1End = midGap1Start + SAFE_GAP_TILES;
  const midGap2Start = colStart + 31;
  const midGap2End = midGap2Start + SAFE_GAP_TILES;
  fillFloor(colStart + 2, midGap1Start, midRow, 0);
  fillFloor(midGap1End, midGap2Start, midRow, 0);
  fillFloor(midGap2End, colEnd - 2, midRow, 0);

  // Bottom drainage crawl: fully continuous, the safe/slow floor.
  fillFloor(colStart + 2, colEnd - 2, botRow);

  addEntity(
    'turretSunflower',
    'turretSunflower-multifloor-top',
    tileCenterX(colStart + 4),
    standingY(topRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-top',
    tileCenterX(topGap2End + 4),
    standingY(topRow),
    16,
    16,
  );
  addEntity(
    'patrolDrone',
    'patrolDrone-multifloor-mid',
    tileCenterX(colStart + 22),
    rowTopY(midRow) - 24,
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-mid',
    tileCenterX(colStart + 6),
    standingY(midRow),
    16,
    16,
  );
  addEntity(
    'sparkBug',
    'sparkBug-multifloor-bottom',
    tileCenterX(colStart + 30),
    standingY(botRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-bottom',
    tileCenterX(colStart + 6),
    standingY(botRow),
    16,
    16,
  );

  segments[26] = {
    colStart,
    colEnd: colStart + H_COLS,
    row: midRow,
    rowEnter: topRow,
    rowExit: midRow,
    topRow,
    midRow,
    botRow,
  };
  segments[27] = {
    colStart: colStart + H_COLS,
    colEnd,
    row: botRow,
    rowEnter: midRow,
    rowExit: botRow,
    topRow,
    midRow,
    botRow,
  };
  cursor.col = colEnd;
  cursor.row = botRow;
  tagEnemy(26, 'turretSunflower');
  tagEnemy(27, 'sparkBug');
}

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[28] = s;
  // Legs Capsule alcove: a short wall-kick chain up from the lower crawl,
  // no weapon gate (GDD §3.1 - "teaches players that secrets exist").
  // Pillars run all the way DOWN to the floor row itself (not stopping
  // short of it) - a wall-kick pillar that stops above the row the
  // player is standing on leaves a gap wider than the ~56px max jump
  // height, making the wall unreachable in the first place.
  const alcoveCol = s.colStart + 8;
  const alcoveRow = s.row - 10;
  fillWall(alcoveCol - 3, alcoveCol, alcoveRow, s.row);
  fillWall(alcoveCol + SAFE_GAP_TILES, alcoveCol + SAFE_GAP_TILES + 3, alcoveRow, s.row);
  fillLedge(alcoveCol - 1, alcoveCol + SAFE_GAP_TILES + 1, alcoveRow);
  addEntity('legsCapsule', 'legsCapsule', tileCenterX(alcoveCol + 2), standingY(alcoveRow), 16, 16);
  addEntity(
    'energyPickup',
    'pickup-breather-end',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
}

// =====================================================================
// Beat 8: Final exam (29-33) - hardest COMBINATION of everything taught
// (gap + spikes + drone, a wall-kick reprise, the full hazard roster
// together, a stair drop) - distinct from escalation's isolated intro
// of each element one at a time.
// =====================================================================
{
  // Compound obstacle: a void gap immediately followed by spikes. Live
  // testing found a full SAFE_GAP_TILES (3-tile) gap here only clears a
  // deliberately-early (~16px-before-the-edge) jump by a fraction of a
  // pixel of theoretical reach - fine for a standalone void gap (nothing
  // rewards jumping early over open ground, so players naturally run to
  // the true edge before jumping), but this gap has spikes waiting
  // immediately after it, which can plausibly make a cautious player
  // jump a little early. Narrowed to 2 tiles here specifically (not
  // globally - the other 5 void gaps in this stage are still 3 tiles,
  // already proven safe under their own normal-timing tests) so the
  // compound sequence has real slack even under an early jump. The
  // landing strip between the gap and the spikes gets its own margin
  // too, not just the two hazards individually - widened from 2 to 4
  // tiles so a slightly-long landing off the gap jump can't carry
  // straight into the spikes before the player gets a chance to plant
  // and re-jump.
  const s = screenRGap(cursor.col + H_COLS, cursor.row, 2);
  segments[29] = s;
  const landingStripTiles = 4;
  const spikeExamALeftCol = s.gap.right + landingStripTiles;
  addHazard(
    'spikes',
    'spikes-exam-A',
    tileCenterX(spikeExamALeftCol + SAFE_SPIKE_TILES / 2),
    standingY(s.row, -2),
    SAFE_SPIKE_TILES * TILE,
    16,
  );
  addEntity(
    'patrolDrone',
    'patrolDrone-exam-A',
    tileCenterX(s.gap.left - 2),
    rowTopY(s.row) - 40,
    16,
    16,
  );
  tagHazard(29, 'spikes');
  tagEnemy(29, 'patrolDrone');
}
segments[30] = screenUShaft(cursor.col + V_COLS, cursor.row);
addEntity(
  'sparkBug',
  'sparkBug-exam-shaft',
  tileCenterX(segments[30].colStart + 2),
  standingY(segments[30].rowEnter),
  16,
  16,
);
tagEnemy(30, 'sparkBug');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[31] = s;
  addHazard('speedStrip', 'speedStrip-exam', tileCenterX(s.colStart + 6), standingY(s.row), 96, 16);
  addHazard(
    'collapsingBridge',
    'bridge-exam-1',
    tileCenterX(s.colStart + 13),
    standingY(s.row),
    32,
    16,
  );
  addEntity(
    'turretSunflower',
    'turretSunflower-exam',
    tileCenterX(s.colStart + 17),
    standingY(s.row),
    16,
    16,
  );
  tagGimmick(31, 'speedStrip');
  tagGimmick(31, 'collapsingBridge');
  tagEnemy(31, 'turretSunflower');
}
segments[32] = screenDStair(cursor.col + V_COLS, cursor.row);
addHazard(
  'electricFence',
  'electricFence-exam',
  tileCenterX(segments[32].treads[1].col),
  rowTopY(segments[32].treads[1].row) - 20,
  16,
  40,
);
addEntity(
  'patrolDrone',
  'patrolDrone-exam-B',
  tileCenterX(segments[32].treads[3].col),
  rowTopY(segments[32].treads[3].row) - 24,
  16,
  16,
);
tagHazard(32, 'electricFence');
tagEnemy(32, 'patrolDrone');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[33] = s;
  addHazard(
    'spikes',
    'spikes-exam-B',
    tileCenterX(s.colStart + 12),
    standingY(s.row, -2),
    SAFE_SPIKE_TILES * TILE,
    16,
  );
  addEntity('energyPickup', 'pickup-exam', tileCenterX(s.colStart + 17), standingY(s.row), 16, 16);
  tagHazard(33, 'spikes');
}

// =====================================================================
// Beat 9: Pre-boss corridor (34-35) -> checkpoint -> boss room.
// =====================================================================
segments[34] = screenDStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'energyPickup',
  'pickup-preboss-1',
  tileCenterX(segments[34].treads[1].col),
  standingY(segments[34].treads[1].row),
  16,
  16,
);
addEntity(
  'energyPickup',
  'pickup-preboss-2',
  tileCenterX(segments[34].treads[3].col),
  standingY(segments[34].treads[3].row),
  16,
  16,
);
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[35] = s;
  addCheckpoint('checkpoint-preboss', 3, tileCenterX(s.colStart + 2), standingY(s.row));
  addEntity('bossDoor', 'bossDoor', tileCenterX(s.colEnd - 2), rowTopY(s.row - 8), 16, 128);
}

// =====================================================================
// Boss room (appended after the counted path, same convention as Reservoir)
// =====================================================================
const bossRoomColStart = cursor.col;
const bossRoomColEnd = cursor.col + H_COLS + 6;
const bossRoomRow = cursor.row;
fillFloor(bossRoomColStart, bossRoomColEnd, bossRoomRow, FILL_DEPTH + 4);
// P1 bugfix: the ENTRY wall must start at its own floor's row, not 40
// rows above it - a full-height pillar right at the room's own entrance
// column completely blocked the walk-in from the pre-boss corridor (the
// same "backstop embeds the entry" bug class fixed repeatedly elsewhere
// in this generator), so the player could never reach bossRoomTrigger,
// beginRitual() never fired, and the boss sat idle forever - looking
// "inert" with no attacks. The far (exit) wall keeps its full height;
// nothing needs to walk past it.
fillWall(bossRoomColStart, bossRoomColStart + 2, bossRoomRow, bossRoomRow + FILL_DEPTH + 4);
fillWall(bossRoomColEnd - 2, bossRoomColEnd, bossRoomRow - 40, bossRoomRow + FILL_DEPTH + 4);
addEntity(
  'bossRoomTrigger',
  'bossRoomTrigger',
  tileCenterX(bossRoomColStart + 2),
  rowTopY(bossRoomRow) - 60,
  16,
  224,
);
addEntity(
  'bossSpawn',
  'volt-cheetah-spawn',
  tileCenterX(bossRoomColStart + Math.floor((bossRoomColEnd - bossRoomColStart) / 2) + 6),
  standingY(bossRoomRow, 10),
  16,
  16,
);
addSection('bossRoom', bossRoomColStart, bossRoomColEnd, bossRoomRow - 40, bossRoomRow + 4);
cursor.col = bossRoomColEnd;

// --- Section markers per beat ------------------------------------------
const beatToScreens = [];
{
  let idx = 1;
  for (const beat of BEATS) {
    const start = idx;
    const end = idx + beat.count - 1;
    beatToScreens.push({ name: beat.name, start, end });
    idx = end + 1;
  }
}
for (const beat of beatToScreens) {
  const first = segments[beat.start];
  const last = segments[beat.end];
  const colStart = first.colStart;
  const colEnd = last.colEnd;
  const rows = [];
  for (let n = beat.start; n <= beat.end; n += 1) {
    const s = segments[n];
    rows.push(s.rowEnter, s.rowExit, s.row);
    if (s.topRow !== undefined) rows.push(s.topRow, s.botRow);
    if (s.midRow !== undefined) rows.push(s.midRow);
  }
  const rowTop = Math.min(...rows) - 20;
  const rowBottom = Math.max(...rows) + 20;
  addSection(beat.name, colStart, colEnd, rowTop, rowBottom);
}

// =====================================================================
// Serialize
// =====================================================================
let minRow = Infinity;
let maxRow = -Infinity;
let minCol = Infinity;
let maxCol = -Infinity;
for (const key of cells.keys()) {
  const [r, c] = key.split(',').map(Number);
  if (r < minRow) minRow = r;
  if (r > maxRow) maxRow = r;
  if (c < minCol) minCol = c;
  if (c > maxCol) maxCol = c;
}
const ROW_MARGIN = 4;
const rowOffset = ROW_MARGIN - Math.min(0, minRow);
const width = Math.max(maxCol + 1, cursor.col);
const height = maxRow + rowOffset + ROW_MARGIN + 1;

const grid = Array.from({ length: height }, () => new Array(width).fill(EMPTY));
for (const [key, gid] of cells.entries()) {
  const [r, c] = key.split(',').map(Number);
  const rr = r + rowOffset;
  if (rr < 0 || rr >= height || c < 0 || c >= width) {
    throw new Error(`tile out of bounds after offset: r=${rr} c=${c} (grid ${width}x${height})`);
  }
  grid[rr][c] = gid;
}
function shiftObjects(objs) {
  for (const o of objs) o.y += rowOffset * TILE;
}
shiftObjects(checkpointObjects);
shiftObjects(entityObjects);
shiftObjects(hazardObjects);
shiftObjects(sectionObjects);

const flatData = [];
for (let r = 0; r < height; r += 1) for (let c = 0; c < width; c += 1) flatData.push(grid[r][c]);

const map = {
  type: 'map',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  compressionlevel: -1,
  width,
  height,
  tilewidth: TILE,
  tileheight: TILE,
  infinite: false,
  nextlayerid: 6,
  nextobjectid: objectId,
  tilesets: [
    {
      firstgid: 1,
      name: 'speedway-placeholder',
      image: 'speedway-placeholder.png',
      imagewidth: 32,
      imageheight: 16,
      tilewidth: 16,
      tileheight: 16,
      tilecount: 2,
      columns: 2,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [
    {
      id: 1,
      type: 'tilelayer',
      name: 'ground',
      width,
      height,
      data: flatData,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
    },
    { id: 2, type: 'objectgroup', name: 'checkpoints', objects: checkpointObjects },
    { id: 3, type: 'objectgroup', name: 'hazards', objects: hazardObjects },
    { id: 4, type: 'objectgroup', name: 'entities', objects: entityObjects },
    { id: 5, type: 'objectgroup', name: 'sections', objects: sectionObjects },
  ],
};

// =====================================================================
// Placement validation (ground-anchor check)
// =====================================================================
function isSolidAt(col, row) {
  return grid[row]?.[col] === TOP || grid[row]?.[col] === FILL;
}
function checkGroundAnchor(obj) {
  const centerCol = Math.floor((obj.x + obj.width / 2) / TILE);
  const footRow = Math.floor((obj.y + obj.height) / TILE);
  for (let dr = 0; dr <= 2; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (isSolidAt(centerCol + dc, footRow + dr)) return true;
    }
  }
  return false;
}
// patrolDrone and pylon are airborne/tall structures whose center isn't at
// floor level by design (orbiting/flying enemy, a vertical pillar) - not
// ground-anchored the way a walking enemy or pickup is.
const groundAnchoredTypes = new Set([
  'sparkBug',
  'turretSunflower',
  'energyPickup',
  'bossSpawn',
  'legsCapsule',
]);
const placementIssues = [];
for (const obj of entityObjects) {
  if (!groundAnchoredTypes.has(obj.type)) continue;
  if (!checkGroundAnchor(obj))
    placementIssues.push(`${obj.type} "${obj.name}" not grounded near (${obj.x},${obj.y})`);
}
for (const obj of checkpointObjects) {
  if (!checkGroundAnchor(obj))
    placementIssues.push(`checkpoint "${obj.name}" not grounded near (${obj.x},${obj.y})`);
}
if (placementIssues.length > 0) {
  console.error('Placement validation FAILED:');
  for (const issue of placementIssues) console.error(' -', issue);
  throw new Error(`${placementIssues.length} placement issue(s)`);
}
console.log(
  'Placement validation: OK (' +
    (entityObjects.length + checkpointObjects.length) +
    ' objects checked)',
);

// =====================================================================
// GDD §2.7 content-variety validation
// =====================================================================
function screenSig(n) {
  const s = screenSignature[n] || { enemies: [], hazards: [], gimmicks: [] };
  return [...s.enemies, ...s.hazards, ...s.gimmicks].sort().join('+') || 'empty';
}
let dupCount = 0;
const dups = [];
for (let n = 2; n <= SEQUENCE.length; n += 1) {
  if (screenSig(n) === screenSig(n - 1) && screenSig(n) !== 'empty') {
    dupCount += 1;
    dups.push([n - 1, n, screenSig(n)]);
  }
}
console.log(`§2.7 consecutive-identical-signature check: ${dupCount} violation(s)`, dups);
if (dupCount > 0)
  throw new Error(
    `${dupCount} consecutive screens share an identical enemy+hazard+gimmick signature`,
  );

const regularEnemyTypes = new Set(['sparkBug', 'patrolDrone', 'turretSunflower']);
let totalEncounters = 0;
const encountersPerBeat = {};
for (let n = 1; n <= SEQUENCE.length; n += 1) {
  const s = screenSignature[n];
  const count = s ? s.enemies.filter((e) => regularEnemyTypes.has(e)).length : 0;
  totalEncounters += count;
  const beat = screenToBeat[n - 1];
  encountersPerBeat[beat] = (encountersPerBeat[beat] || 0) + count;
}
const density = SEQUENCE.length / totalEncounters;
console.log(
  `§2.7 density: ${totalEncounters} regular-enemy encounters / ${SEQUENCE.length} screens = ${density.toFixed(2)} screens/encounter (target 1.5-2.0)`,
);
if (density < 1.4 || density > 2.1)
  throw new Error(`density ${density.toFixed(2)} outside the 1.5-2.0 target band`);
console.log('Encounters per beat:', JSON.stringify(encountersPerBeat));

const gimmickScreens = [];
for (let n = 1; n <= SEQUENCE.length; n += 1)
  if (screenSignature[n] && screenSignature[n].gimmicks.length > 0) gimmickScreens.push(n);
console.log(
  'Gimmick-usage screens (speed strip / collapsing bridge, the through-line gimmick):',
  JSON.stringify(gimmickScreens),
);
const beatsWithGimmick = new Set(gimmickScreens.map((n) => screenToBeat[n - 1]));
console.log(
  'Beats touched by the gimmick:',
  JSON.stringify([...beatsWithGimmick].sort((a, b) => a - b)),
);
if (!beatsWithGimmick.has(6)) throw new Error('setpiece (beat 6) has no gimmick usage');
if (!beatsWithGimmick.has(8)) throw new Error('finalExam (beat 8) has no gimmick usage');

// =====================================================================
// Surface-variation check (GDD §2.7: "Ground surface is NOT a monotonic
// slope... no more than 3 consecutive screens with near-zero vertical
// variation") - computed from the raw grid, not the generator's own
// segment bookkeeping (see Reservoir's screen-numbering-discrepancy
// lesson in DECISIONS.md: trust the tile data, not internal labels).
// =====================================================================
function topSolidRowAt(col) {
  for (let r = 0; r < height; r += 1) if (grid[r][col] === TOP) return r;
  return null;
}
const realScreenCount = Math.ceil(width / H_COLS);
const surfaceByRealScreen = [];
for (let sIdx = 0; sIdx < realScreenCount; sIdx += 1) {
  const colStart = sIdx * H_COLS;
  const colEnd = Math.min(colStart + H_COLS, width);
  const rows = [];
  for (let c = colStart; c < colEnd; c += 1) {
    const r = topSolidRowAt(c);
    if (r !== null) rows.push(r);
  }
  if (rows.length > 0)
    surfaceByRealScreen.push({ screen: sIdx + 1, min: Math.min(...rows), max: Math.max(...rows) });
}
let flatRun = 0;
let maxFlatRun = 0;
for (let i = 1; i < surfaceByRealScreen.length; i += 1) {
  const delta = Math.abs(surfaceByRealScreen[i].min - surfaceByRealScreen[i - 1].min);
  if (delta <= 1) {
    flatRun += 1;
    maxFlatRun = Math.max(maxFlatRun, flatRun);
  } else {
    flatRun = 0;
  }
}
const surfaceMin = Math.min(...surfaceByRealScreen.map((s) => s.min));
const surfaceMax = Math.max(...surfaceByRealScreen.map((s) => s.min));
console.log(
  `\nSurface-variation check (real ${H_COLS}-tile screens): min-row range ${surfaceMin}-${surfaceMax} (${(((surfaceMax - surfaceMin) * TILE) / 180).toFixed(2)} screens of vertical range), longest near-flat run ${maxFlatRun} real screens`,
);
if (maxFlatRun > 3)
  throw new Error(`surface has ${maxFlatRun} consecutive near-flat real screens (limit 3)`);

// =====================================================================
// GDD §2.5 pillar 1 fairness audit: every void gap AND every lethal
// ground hazard (spikes), measured in tiles, checked against the
// discipline-specific safe ceilings above. Void gaps and spikes are
// checked separately (not against the same ceiling) because a spike
// patch is far less forgiving of an early jump than an equivalent-width
// void gap is - see SAFE_SPIKE_TILES's comment for the live-tested
// reasoning. Found via the same raw-tile gap scan used in the original
// base-kit jump-reach bugfix (scan every column for the topmost solid
// tile, group empty-column runs into gaps), reused here as a mechanical
// gate rather than trusted by construction.
// =====================================================================
function topSolidRowAtAnyLayer(col) {
  for (let r = 0; r < height; r += 1) if (grid[r][col] !== EMPTY) return r;
  return null;
}
const colTop = [];
for (let c = 0; c < width; c += 1) colTop.push(topSolidRowAtAnyLayer(c));
const voidGaps = [];
{
  let gapStart = null;
  for (let c = 0; c < width; c += 1) {
    if (colTop[c] === null) {
      if (gapStart === null) gapStart = c;
    } else if (gapStart !== null) {
      voidGaps.push({ colStart: gapStart, colEnd: c, tiles: c - gapStart });
      gapStart = null;
    }
  }
}
console.log('\nVoid-gap audit (full-column empty runs, ceiling: ' + SAFE_GAP_TILES + ' tiles):');
let voidGapFailures = 0;
for (const g of voidGaps) {
  const ok = g.tiles <= SAFE_GAP_TILES;
  if (!ok) voidGapFailures += 1;
  console.log(
    `  cols ${g.colStart}-${g.colEnd}: ${g.tiles} tiles (${g.tiles * TILE}px) - ${ok ? 'OK' : 'FAIL'}`,
  );
}
if (voidGapFailures > 0)
  throw new Error(`${voidGapFailures} void gap(s) exceed ${SAFE_GAP_TILES} tiles`);

console.log(`\nSpike-hazard audit (ceiling: ${SAFE_SPIKE_TILES} tiles):`);
let spikeFailures = 0;
for (const hz of hazardObjects) {
  if (hz.type !== 'spikes') continue;
  const tiles = hz.width / TILE;
  const ok = tiles <= SAFE_SPIKE_TILES;
  if (!ok) spikeFailures += 1;
  console.log(`  ${hz.name}: ${tiles} tiles (${hz.width}px) - ${ok ? 'OK' : 'FAIL'}`);
}
if (spikeFailures > 0)
  throw new Error(`${spikeFailures} spike hazard(s) exceed ${SAFE_SPIKE_TILES} tiles`);

// =====================================================================
// Boss-room entry reachability regression check (P1 bugfix: a full-
// height wall right at bossRoomColStart - the exact "backstop embeds
// the entry" bug class fixed repeatedly elsewhere in this generator -
// completely blocked the walk-in from the pre-boss corridor, so the
// player could never reach bossRoomTrigger and the boss sat idle
// forever, looking "inert"). Checks that the two entry columns are open
// at head height (a few rows above the floor down to the floor itself),
// not just that a floor tile exists - a solid pillar spanning those same
// columns at head height would pass a naive "is there ground here" check
// while still blocking the player completely.
// =====================================================================
{
  const headroomRows = 3; // taller than the player's ~1.5-tile hurtbox, with margin
  const entryCols = [bossRoomColStart, bossRoomColStart + 1];
  const blockedRows = [];
  for (const col of entryCols) {
    for (let r = bossRoomRow - headroomRows; r < bossRoomRow; r += 1) {
      if (grid[r + rowOffset]?.[col] !== EMPTY) blockedRows.push({ col, row: r });
    }
  }
  console.log(
    `\nBoss-room entry reachability check (cols ${entryCols.join(',')}, rows ${bossRoomRow - headroomRows}-${bossRoomRow - 1}): ${blockedRows.length === 0 ? 'OK - walk-in clear' : 'FAIL'}`,
  );
  if (blockedRows.length > 0) {
    throw new Error(
      `boss-room entry blocked at head height: ${JSON.stringify(blockedRows)} - the entry wall must start at bossRoomRow, not above it`,
    );
  }
}

// =====================================================================
// Route map + full report
// =====================================================================
console.log('Map size:', width, 'x', height, 'tiles =', width * TILE, 'x', height * TILE, 'px');
console.log(
  'Real (320px) screens:',
  realScreenCount,
  `(${((height * TILE) / 180).toFixed(2)} screens tall)`,
);
console.log('Total generator screens:', SEQUENCE.length);
console.log('Beats:', beatToScreens.map((b) => `${b.name}(${b.start}-${b.end})`).join(', '));

const startRow = segments[1].row;
const levels = [];
for (let n = 1; n <= SEQUENCE.length; n += 1)
  levels.push(Math.round((segments[n].row - startRow) / V_COLS));
const minLevel = Math.min(...levels);
const maxLevel = Math.max(...levels);
const mapLines = [];
for (let level = minLevel; level <= maxLevel; level += 1) {
  const label = (level === 0 ? '+0' : level > 0 ? `+${level}` : `${level}`).padStart(3, ' ');
  let line = `${label} |`;
  for (const lvl of levels) line += lvl === level ? '#' : ' ';
  line += '|';
  mapLines.push(line);
}
console.log('');
console.log(
  'Route map (' + SEQUENCE.length + ' screens; # = path elevation, one column per screen):',
);
console.log('```');
for (const line of mapLines) console.log(line);
console.log('    +' + '-'.repeat(SEQUENCE.length) + '+');
console.log('```');

console.log(
  '\nPer-screen surface row (real 320px screens, raw tile scan, before ROW_MARGIN offset re-applied):',
);
console.log(JSON.stringify(surfaceByRealScreen));

console.log('\nDECLARED AXIS: HORIZONTAL-DOMINANT (vertical target >=20%)');
console.log(
  `Structural element 1/2 - CONTROLLED DESCENT (boost-strip): generator screens ${descentRangeStart}-${descentRangeEnd}`,
);
console.log(
  `Structural element 2/2 - MULTI-FLOOR ROOM (highway underpass, 3 shallow decks, 2 real screens): generator screens 26-27`,
);
console.log(
  'Ascent shaft: NOT used as a structural element (not required for a horizontal-dominant stage) - ' +
    'one short wall-kick leg kept as texture only at generator screen 30 (finalExam), matching GDD ' +
    '§3.1 (\"short wall-kick climbs are fine as texture\").',
);
console.log(
  `BRANCH & REJOIN (turbine tower, mandatory for every stage): fork screen ${branchForkScreen}, rejoin screen ${branchRejoinScreen}`,
);

const outPath = process.argv[2] || 'speedway.json';
fs.writeFileSync(outPath, JSON.stringify(map));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
