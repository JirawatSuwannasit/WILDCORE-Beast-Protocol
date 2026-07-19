// Generator for Coral Reservoir's Tiled JSON map (GDD §2.6/§3.2, M4.1).
// Mirrors the M2-REBUILD-2 methodology documented in DECISIONS.md: author
// the route as a per-screen R/U/D direction sequence, walk it building a
// sparse tile map + segment log, place every entity/hazard/checkpoint by
// looking up its screen's logged segment (never hand-recompute rows), then
// run a mechanical validation pass (axis-mix %, run-length, direction
// changes, gap-vs-jump-reach, ground-anchor checks) before writing the file.

import fs from 'node:fs';

const TILE = 16;
const H_COLS = 20; // horizontal screen width, tiles (320px, GDD §2.6's native-view screen)
const V_COLS = 12; // vertical screen width, tiles (192px, the "vertical screen" unit)
const FILL_DEPTH = 10; // tiles of solid fill rendered beneath any floor top (comfortably below the 11.25-tile-tall viewport)
const EMPTY = 0;
const FILL = 1; // GID 1: bulk fill tile
const TOP = 2; // GID 2: floor-top tile

// --- Sparse grid -----------------------------------------------------------
const cells = new Map(); // "row,col" -> gid
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
  // Solid block, both a wall (vertical face) and safe to double as fill.
  for (let c = colStart; c < colEnd; c += 1) {
    for (let r = rowStart; r <= rowEnd; r += 1) setTile(c, r, FILL);
  }
}
function fillLedge(colStart, colEnd, row) {
  fillFloor(colStart, colEnd, row, 3);
}

// --- Screen walk -------------------------------------------------------
// tag: 'R' horizontal (20 cols, baseline unchanged)
//      'D' vertical descent (12 cols, baseline += 12 over the screen)
//      'U' vertical ascent (12 cols, baseline -= 12 over the screen)
const SEQUENCE = [
  // Beat 1: Intro (3) - safe, sells theme, ends on a gentle first descent
  'R',
  'R',
  'D',
  // Beat 2: Gimmick tutorial (5) - valve/float physics, harmless
  'D',
  'R',
  'D',
  'R',
  'D',
  // Beat 3: Escalation (5) - gimmick + enemies combined
  'R',
  'D',
  'R',
  'D',
  'R',
  // Beat 4: Mid-boss arena (1) -> checkpoint
  'R',
  // Beat 5: Remix / second gimmick (6) - long descent, multi-floor valve room, branch+rejoin
  'D',
  'D',
  'D',
  'R',
  'R',
  'D',
  // Beat 6: Setpiece (5) - mandatory wall-kick ASCENT shaft -> checkpoint
  'U',
  'U',
  'U',
  'R',
  'U',
  // Beat 7: Breather + secret branch (3)
  'R',
  'D',
  'R',
  // Beat 8: Final exam (5) - hardest combination of everything taught
  'D',
  'R',
  'U',
  'R',
  'D',
  // Beat 9: Pre-boss corridor (2) -> checkpoint -> boss room
  'R',
  'R',
];

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

// --- Route-shape validation (mechanical, per DECISIONS.md M2-REBUILD-2) ---
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
  for (let i = 1; i < sequence.length; i += 1) {
    if (sequence[i] !== sequence[i - 1]) changes += 1;
  }

  return { total, vertical, verticalPct, maxRun, changes };
}

const stats = validateRouteShape(SEQUENCE);
console.log('Route-shape stats:', stats);
if (stats.total < 28 || stats.total > 36)
  throw new Error(`screen count ${stats.total} outside 28-36`);
if (stats.verticalPct < 35) throw new Error(`vertical% ${stats.verticalPct} below 35`);
if (stats.maxRun > 3) throw new Error(`max same-direction run ${stats.maxRun} exceeds 3`);
if (stats.changes < 4) throw new Error(`direction changes ${stats.changes} below 4`);

// --- Screen-by-screen authoring -----------------------------------------
// cursor.row is always the CURRENT walkable floor's top row at cursor.col
// (i.e. the baseline the next screen starts from). Every screen's authoring
// function reads cursor, writes tiles, appends its own {colStart,colEnd,
// rowEnter,rowExit} to `segments` (indexed by 1-based screen number - the
// single source of truth every later entity/checkpoint placement reads
// from), and advances cursor.
const cursor = { col: 0, row: 40 }; // row=40 gives ~40 tiles of headroom for the ascent shaft (beat 6) to climb into without going negative
const segments = []; // 1-indexed via segments[screenNumber]
let objectId = 1;
const nextId = () => objectId++;

function screenR(colEnd, row) {
  fillFloor(cursor.col, colEnd, row);
  const seg = { colStart: cursor.col, colEnd, row, rowEnter: row, rowExit: row };
  cursor.col = colEnd;
  return seg;
}

function screenD(colEnd, rowStart) {
  // Glass-tunnel chute: side walls both edges, 2 staggered ledges (left then right),
  // baseline drops by 12 tiles (V_COLS) across the screen. "Controlled descent,
  // readable landings" (GDD §2.6) - never a single sheer 12-tile drop.
  const rowEnd = rowStart + V_COLS;
  const wallTop = rowStart - 6; // headroom above entry so the fall is visible before it starts
  const wallBottom = rowEnd + FILL_DEPTH;
  fillWall(cursor.col, cursor.col + 2, wallTop, wallBottom);
  fillWall(colEnd - 2, colEnd, wallTop, wallBottom);
  const ledge1Row = rowStart + 4;
  const ledge2Row = rowStart + 8;
  fillLedge(cursor.col + 2, cursor.col + 5, ledge1Row);
  fillLedge(colEnd - 5, colEnd - 2, ledge2Row);
  fillFloor(colEnd - 2, colEnd, rowEnd); // small landing lip at the exit, flush with the wall
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    ledge1: { col: cursor.col + 3, row: ledge1Row },
    ledge2: { col: colEnd - 4, row: ledge2Row },
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

function screenU(colEnd, rowStart) {
  // Wall-kick ascent shaft: two facing walls, 3-tile gap (the width the
  // Speedway bugfix log confirmed is comfortably kickable - see DECISIONS.md).
  const rowEnd = rowStart - V_COLS;
  const wallTop = rowEnd - 4;
  const wallBottom = rowStart + FILL_DEPTH;
  const gapWidth = 3;
  const midCol = cursor.col + Math.floor((colEnd - cursor.col) / 2);
  const leftWallEnd = midCol - Math.ceil(gapWidth / 2);
  const rightWallStart = midCol + Math.ceil(gapWidth / 2);
  fillWall(cursor.col, leftWallEnd, wallTop, wallBottom);
  fillWall(rightWallStart, colEnd, wallTop, wallBottom);
  fillFloor(cursor.col, leftWallEnd, rowStart); // entry ledge
  fillFloor(rightWallStart, colEnd, rowEnd); // exit ledge (opposite wall - forces a real kick chain)
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

// --- Object layers -------------------------------------------------------
const checkpointObjects = [];
const entityObjects = [];
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

// Center-of-tile-row Y for something standing ON row `row` (i.e. row is the
// floor-top tile index - an entity standing on it has its own center a
// little above that top edge).
function standingY(row, entityHalfHeight = 8) {
  return row * TILE - entityHalfHeight;
}

// =====================================================================
// Beat 1: Intro (screens 1-3) - R R D
// =====================================================================
addEntity('playerSpawn', 'playerSpawn', tileCenterX(2), standingY(cursor.row), 16, 16);
segments[1] = screenR(cursor.col + H_COLS, cursor.row);
addCheckpoint(
  'checkpoint-start',
  0,
  tileCenterX(segments[1].colStart + 2),
  standingY(segments[1].row),
);

segments[2] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-intro',
  tileCenterX(segments[2].colStart + 10),
  standingY(segments[2].row, 5),
  16,
  16,
);

segments[3] = screenD(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 2: Gimmick tutorial (screens 4-8) - D R D R D
// =====================================================================
segments[4] = screenD(cursor.col + V_COLS, cursor.row);

// Screen 5: tutorial valve room - one small pool, harmless intro to
// valve+float physics. Valve toggles Gate #1 which opens a shallow alcove
// with a pickup below the floor - nothing punishing if fumbled.
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[5] = s;
  const poolColStart = s.colStart + 6;
  const poolColEnd = s.colStart + 14;
  const gateRow = s.row; // the gate sits flush in the main floor
  // Carve the gate's gap + alcove in the floor tiles themselves (screenR
  // already filled solid there - punch out an open pocket before placing
  // the gate, leaving 2 rows of original fill as the alcove's own floor
  // so the pickup below has real solid ground under it, not empty air
  // inside a still-solid block).
  for (let c = poolColStart; c < poolColEnd; c += 1) {
    for (let d = 0; d <= 6; d += 1) cells.delete(`${gateRow + d},${c}`);
  }
  addEntity('waterValve', 'valve-tutorial', tileCenterX(s.colStart + 3), standingY(s.row), 12, 16, [
    { name: 'targetGate', type: 'string', value: 'gate-tutorial' },
  ]);
  addEntity(
    'waterGate',
    'gate-tutorial',
    tileCenterX((poolColStart + poolColEnd) / 2),
    rowTopY(gateRow) + (7 * TILE) / 2,
    (poolColEnd - poolColStart) * TILE,
    7 * TILE,
    [{ name: 'startsOpen', type: 'bool', value: false }],
  );
  addEntity(
    'energyPickup',
    'pickup-tutorial-pool',
    tileCenterX((poolColStart + poolColEnd) / 2),
    standingY(gateRow + 6),
    16,
    16,
  );
}

segments[6] = screenD(cursor.col + V_COLS, cursor.row);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[7] = s;
  addEntity(
    'dartFish',
    'dartFish-tutorial',
    tileCenterX(s.colStart + 12),
    standingY(s.row, 5),
    16,
    16,
  );
}

segments[8] = screenD(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 3: Escalation (screens 9-13) - R D R D R
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[9] = s;
  addEntity(
    'bubbleCrab',
    'bubbleCrab-escalation',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-escalation-1',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
}

segments[10] = screenD(cursor.col + V_COLS, cursor.row);
// current debut - a short helpful upward push riding alongside the second ledge
addEntity(
  'current',
  'current-escalation-debut',
  tileCenterX(segments[10].ledge2.col),
  rowTopY(segments[10].ledge2.row) - 24,
  16,
  48,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -70 },
  ],
);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[11] = s;
  addEntity(
    'toxicUrchin',
    'urchin-escalation',
    tileCenterX(s.colStart + 8),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-escalation-2',
    tileCenterX(s.colStart + 15),
    standingY(s.row, 8),
    16,
    16,
  );
}

segments[12] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-escalation',
  tileCenterX(segments[12].ledge1.col),
  standingY(segments[12].ledge1.row, 5),
  16,
  16,
);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[13] = s;
  addEntity(
    'toxicUrchin',
    'urchin-escalation-2',
    tileCenterX(s.colStart + 6),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-escalation-3',
    tileCenterX(s.colStart + 13),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-escalation-2',
    tileCenterX(s.colStart + 17),
    standingY(s.row),
    16,
    16,
  );
}

// =====================================================================
// Beat 4: Mid-boss arena (screen 14) -> checkpoint
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[14] = s;
  addEntity(
    'anglerfishSpawn',
    'anglerfish-spawn',
    tileCenterX(s.colStart + 12),
    standingY(s.row, 12),
    24,
    20,
  );
  addEntity(
    'midBossRoomTrigger',
    'midBossRoomTrigger',
    tileCenterX(s.colStart + 2),
    rowTopY(s.row) - 60,
    8,
    120,
  );
  addCheckpoint('checkpoint-post-midboss', 1, tileCenterX(s.colEnd - 2), standingY(s.row));
}

// =====================================================================
// Beat 5: Remix / second gimmick (screens 15-20) - D D D R R D
// Long descent + multi-floor valve layer choice + branch/rejoin.
// =====================================================================
segments[15] = screenD(cursor.col + V_COLS, cursor.row);
segments[16] = screenD(cursor.col + V_COLS, cursor.row);

// Screen 17: multi-floor valve room - 3 stacked tiers, 2 valves/gates.
// Valve A gates top->mid; Valve B gates mid->bottom. Genuine layer choice:
// stop at mid (safe) or open both to reach the bottom tier (extra pickups).
{
  const colStart = cursor.col;
  const colEnd = cursor.col + V_COLS;
  const topRow = cursor.row;
  const midRow = topRow + 6;
  const botRow = topRow + 12;
  fillWall(colStart, colStart + 2, topRow - 4, botRow + FILL_DEPTH);
  fillWall(colEnd - 2, colEnd, topRow - 4, botRow + FILL_DEPTH);
  fillFloor(colStart + 2, colEnd - 2, topRow, 0);
  fillFloor(colStart + 2, colEnd - 2, midRow, 0);
  fillFloor(colStart + 2, colEnd - 2, botRow);
  const gateAColStart = colStart + 4;
  const gateAColEnd = colStart + 8;
  const gateBColStart = colStart + 4;
  const gateBColEnd = colStart + 8;
  // Clear the FULL shaft height behind each gate (not just its top row) -
  // the gate's own runtime collider (WaterGate) is what supplies the
  // "closed" solidity at runtime; the baked ground-tile layer must stay
  // empty here or opening the gate wouldn't actually open anything.
  for (let c = gateAColStart; c < gateAColEnd; c += 1) {
    for (let r = topRow; r < midRow; r += 1) cells.delete(`${r},${c}`);
  }
  for (let c = gateBColStart; c < gateBColEnd; c += 1) {
    for (let r = midRow; r < botRow; r += 1) cells.delete(`${r},${c}`);
  }
  addEntity(
    'waterValve',
    'valve-multifloor-A',
    tileCenterX(colStart + 3),
    standingY(topRow),
    12,
    16,
    [{ name: 'targetGate', type: 'string', value: 'gate-multifloor-A' }],
  );
  addEntity(
    'waterGate',
    'gate-multifloor-A',
    tileCenterX((gateAColStart + gateAColEnd) / 2),
    rowTopY(topRow) + ((midRow - topRow) * TILE) / 2,
    (gateAColEnd - gateAColStart) * TILE,
    (midRow - topRow) * TILE,
    [{ name: 'startsOpen', type: 'bool', value: false }],
  );
  addEntity(
    'waterValve',
    'valve-multifloor-B',
    tileCenterX(colStart + 3),
    standingY(midRow),
    12,
    16,
    [{ name: 'targetGate', type: 'string', value: 'gate-multifloor-B' }],
  );
  addEntity(
    'waterGate',
    'gate-multifloor-B',
    tileCenterX((gateBColStart + gateBColEnd) / 2),
    rowTopY(midRow) + ((botRow - midRow) * TILE) / 2,
    (gateBColEnd - gateBColStart) * TILE,
    (botRow - midRow) * TILE,
    [{ name: 'startsOpen', type: 'bool', value: false }],
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-mid',
    tileCenterX(colEnd - 4),
    standingY(midRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-bottom',
    tileCenterX(colEnd - 4),
    standingY(botRow),
    16,
    16,
  );
  segments[17] = {
    colStart,
    colEnd,
    row: botRow,
    rowEnter: topRow,
    rowExit: botRow,
    topRow,
    midRow,
    botRow,
  };
  cursor.col = colEnd;
  cursor.row = botRow;
}

// Screen 18: short connector into the branch.
segments[18] = screenR(cursor.col + H_COLS, cursor.row);

// Screen 19: BRANCH - upper flooded gallery (currents + pickups) vs lower
// drained maintenance crawl (safe, slow); rejoin at the end. Body Capsule
// pump shaft hangs off the LOWER route (secrets branch off the less
// obvious side, per GDD §2.6).
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS;
  const lowerRow = cursor.row;
  const upperRow = cursor.row - 3; // 48px step - within the 56px (3.5-tile) max jump ceiling
  fillFloor(colStart, colEnd, lowerRow); // lower maintenance crawl: continuous, safe
  fillFloor(colStart + 2, colEnd - 6, upperRow, 3); // upper gallery: stops 6 tiles short of the end, so it free-falls to rejoin (Speedway's fork technique)
  fillWall(colStart, colStart + 2, upperRow, lowerRow + FILL_DEPTH); // step block: a single max-height jump from the lower floor reaches its upperRow top

  addEntity(
    'current',
    'current-branch-upper',
    tileCenterX(colStart + 8),
    rowTopY(upperRow) - 10,
    (colEnd - 6 - (colStart + 2)) * TILE,
    20,
    [
      { name: 'pushX', type: 'int', value: 40 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-branch-upper',
    tileCenterX(colStart + 12),
    standingY(upperRow, 8),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-branch-upper-1',
    tileCenterX(colStart + 6),
    standingY(upperRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-branch-upper-2',
    tileCenterX(colStart + 11),
    standingY(upperRow),
    16,
    16,
  );

  // Lower route: safe/slow, dead-ends in the Body Capsule secret alcove.
  addEntity(
    'toxicUrchin',
    'urchin-branch-lower',
    tileCenterX(colStart + 10),
    standingY(lowerRow, 5),
    12,
    12,
  );
  const alcoveCol = colStart + 3;
  addEntity(
    'bodyCapsulePump',
    'bodyCapsulePump',
    tileCenterX(alcoveCol),
    standingY(lowerRow),
    16,
    24,
  );

  segments[19] = {
    colStart,
    colEnd,
    row: lowerRow,
    rowEnter: lowerRow,
    rowExit: lowerRow,
    upperRow,
    lowerRow,
  };
  cursor.col = colEnd;
  cursor.row = lowerRow;
}

segments[20] = screenD(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 6: Setpiece (screens 21-25) - U U U R U
// Mandatory wall-kick ASCENT up a drained elevator shaft (vertical camera zone).
// =====================================================================
const ascentShaftColStart = cursor.col;
segments[21] = screenU(cursor.col + V_COLS, cursor.row);
segments[22] = screenU(cursor.col + V_COLS, cursor.row);
segments[23] = screenU(cursor.col + V_COLS, cursor.row);

// Screen 24: mid-shaft plateau/landing, breaks the run, small pickup.
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[24] = s;
  addEntity(
    'energyPickup',
    'pickup-shaft-plateau',
    tileCenterX(s.colStart + 10),
    standingY(s.row),
    16,
    16,
  );
  addEntity(
    'dartFish',
    'dartFish-shaft-plateau',
    tileCenterX(s.colStart + 15),
    standingY(s.row, 5),
    16,
    16,
  );
}

segments[25] = screenU(cursor.col + V_COLS, cursor.row);
const ascentShaftColEnd = cursor.col;
addEntity(
  'ascentShaftZone',
  'elevatorAscentShaftZone',
  tileCenterX((ascentShaftColStart + ascentShaftColEnd) / 2),
  rowTopY(segments[25].rowExit - 4),
  (ascentShaftColEnd - ascentShaftColStart) * TILE,
  (segments[21].rowEnter - segments[25].rowExit + 10) * TILE,
);
addCheckpoint(
  'checkpoint-post-setpiece',
  2,
  tileCenterX(segments[25].colEnd - 4),
  standingY(segments[25].row),
);

// =====================================================================
// Beat 7: Breather + secret branch (screens 26-28) - R D R
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[26] = s;
  addEntity(
    'energyPickup',
    'pickup-breather-1',
    tileCenterX(s.colStart + 6),
    standingY(s.row),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-breather-2',
    tileCenterX(s.colStart + 14),
    standingY(s.row),
    16,
    16,
  );
}

segments[27] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'energyPickup',
  'pickup-breather-dip',
  tileCenterX(segments[27].ledge2.col),
  standingY(segments[27].ledge2.row),
  16,
  16,
);

segments[28] = screenR(cursor.col + H_COLS, cursor.row);

// =====================================================================
// Beat 8: Final exam (screens 29-33) - D R U R D
// =====================================================================
segments[29] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'current',
  'current-exam-1',
  tileCenterX(segments[29].ledge1.col),
  rowTopY(segments[29].ledge1.row) - 20,
  16,
  40,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -60 },
  ],
);
addEntity(
  'bubbleCrab',
  'bubbleCrab-exam-1',
  tileCenterX(segments[29].ledge2.col),
  standingY(segments[29].ledge2.row, 8),
  16,
  16,
);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[30] = s;
  addEntity(
    'toxicUrchin',
    'urchin-exam-1',
    tileCenterX(s.colStart + 5),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity('dartFish', 'dartFish-exam', tileCenterX(s.colStart + 10), standingY(s.row, 5), 16, 16);
  addEntity(
    'bubbleCrab',
    'bubbleCrab-exam-2',
    tileCenterX(s.colStart + 15),
    standingY(s.row, 8),
    16,
    16,
  );
}

segments[31] = screenU(cursor.col + V_COLS, cursor.row);
addEntity(
  'current',
  'current-exam-2',
  tileCenterX((segments[31].gap.left + segments[31].gap.right) / 2),
  rowTopY(segments[31].rowEnter - 6),
  (segments[31].gap.right - segments[31].gap.left) * TILE,
  40,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -50 },
  ],
);

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[32] = s;
  addEntity(
    'toxicUrchin',
    'urchin-exam-2',
    tileCenterX(s.colStart + 8),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-exam-3',
    tileCenterX(s.colStart + 14),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity('energyPickup', 'pickup-exam', tileCenterX(s.colStart + 18), standingY(s.row), 16, 16);
}

segments[33] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'toxicUrchin',
  'urchin-exam-3',
  tileCenterX(segments[33].ledge1.col),
  standingY(segments[33].ledge1.row, 5),
  12,
  12,
);
addEntity(
  'current',
  'current-exam-3',
  tileCenterX(segments[33].ledge2.col),
  rowTopY(segments[33].ledge2.row) - 20,
  16,
  40,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -60 },
  ],
);

// =====================================================================
// Beat 9: Pre-boss corridor (screens 34-35) -> checkpoint -> boss room
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[34] = s;
  addEntity(
    'energyPickup',
    'pickup-preboss-1',
    tileCenterX(s.colStart + 8),
    standingY(s.row),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-preboss-2',
    tileCenterX(s.colStart + 15),
    standingY(s.row),
    16,
    16,
  );
}

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[35] = s;
  addCheckpoint('checkpoint-preboss', 3, tileCenterX(s.colStart + 2), standingY(s.row));
  addEntity('bossDoor', 'bossDoor', tileCenterX(s.colEnd - 2), rowTopY(s.row - 8), 16, 128);
}

// =====================================================================
// Boss room (appended after the counted 28-36 path, same convention as Speedway)
// =====================================================================
const bossRoomColStart = cursor.col;
const bossRoomColEnd = cursor.col + H_COLS + 6;
const bossRoomRow = cursor.row;
fillFloor(bossRoomColStart, bossRoomColEnd, bossRoomRow, FILL_DEPTH + 4);
fillWall(bossRoomColStart, bossRoomColStart + 2, bossRoomRow - 40, bossRoomRow + FILL_DEPTH + 4);
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
  'tide-manta-spawn',
  tileCenterX(bossRoomColStart + Math.floor((bossRoomColEnd - bossRoomColStart) / 2) + 6),
  standingY(bossRoomRow, 10),
  16,
  16,
);
addSection('bossRoom', bossRoomColStart, bossRoomColEnd, bossRoomRow - 40, bossRoomRow + 4);
cursor.col = bossRoomColEnd;

// --- Section markers for every beat (debug overlay "near:" landmarks) -----
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
    if (s.topRow !== undefined) rows.push(s.topRow, s.midRow, s.botRow);
  }
  const rowTop = Math.min(...rows) - 20;
  const rowBottom = Math.max(...rows) + 20;
  addSection(beat.name, colStart, colEnd, rowTop, rowBottom);
}

// =====================================================================
// Serialize grid -> Tiled JSON
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
shiftObjects(sectionObjects);

const flatData = [];
for (let r = 0; r < height; r += 1) {
  for (let c = 0; c < width; c += 1) flatData.push(grid[r][c]);
}

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
      name: 'reservoir-placeholder',
      image: 'reservoir-placeholder.png',
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
    { id: 3, type: 'objectgroup', name: 'hazards', objects: [] },
    { id: 4, type: 'objectgroup', name: 'entities', objects: entityObjects },
    { id: 5, type: 'objectgroup', name: 'sections', objects: sectionObjects },
  ],
};

// =====================================================================
// Placement validation: every ground-anchored object must sit on real
// solid ground directly beneath it (per M2-REBUILD-2's own discipline).
// =====================================================================
function isSolidAt(col, row) {
  return grid[row]?.[col] === TOP || grid[row]?.[col] === FILL;
}
function checkGroundAnchor(obj) {
  const centerCol = Math.floor((obj.x + obj.width / 2) / TILE);
  const footRow = Math.floor((obj.y + obj.height) / TILE);
  // allow +/- 1 tile slack (entities are centered, not pixel-perfect on the grid)
  for (let dr = 0; dr <= 2; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (isSolidAt(centerCol + dc, footRow + dr)) return true;
    }
  }
  return false;
}

const groundAnchoredTypes = new Set([
  'dartFish',
  'bubbleCrab',
  'toxicUrchin',
  'waterValve',
  'bodyCapsulePump',
  'energyPickup',
  'anglerfishSpawn',
  'bossSpawn',
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
// Gap reachability: scan the ground layer for columns with zero solid
// tiles anywhere reachable and flag ones wider than the player's jump
// ceiling, EXCLUDING the intentional vertical-shaft/branch gaps (which
// are crossed by fall/swim/wall-kick, not a flat jump).
// =====================================================================
// (Reservoir's gaps are all intentional vertical-traversal or branch
// free-fall gaps, not flat-ground jump gaps like Speedway's - skip the
// flat-jump-ceiling check here and instead just report the map's overall
// dimensions/extent for a sanity read.)

console.log('Map size:', width, 'x', height, 'tiles =', width * TILE, 'x', height * TILE, 'px');
console.log('Total screens:', SEQUENCE.length);
console.log('Beats:', beatToScreens.map((b) => `${b.name}(${b.start}-${b.end})`).join(', '));

// =====================================================================
// ASCII route map (mechanically derived from the actual segment log, not
// hand-typed) - one column per screen, elevation level = (row - startRow)
// / V_COLS, rounded. Level 0 = the stage's starting baseline; higher
// levels = deeper (this stage's identity is a net DESCENT, so the whole
// profile trends downward, unlike Speedway's up-and-down balance).
// =====================================================================
const startRow = segments[1].row;
const levels = [];
for (let n = 1; n <= SEQUENCE.length; n += 1) {
  levels.push(Math.round((segments[n].row - startRow) / V_COLS));
}
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

const outPath = process.argv[2] || 'reservoir.json';
fs.writeFileSync(outPath, JSON.stringify(map));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
