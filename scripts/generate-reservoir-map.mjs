// Generator for Coral Reservoir's Tiled JSON map (GDD §2.6/§2.7/§3.2, M4.1-REBUILD).
// Mirrors the M2-REBUILD-2 methodology documented in DECISIONS.md: author
// the route as a per-screen R/U/D direction sequence, walk it building a
// sparse tile map + segment log, place every entity/hazard/checkpoint by
// looking up its screen's logged segment (never hand-recompute rows), then
// run a mechanical validation pass (axis-mix %, run-length, direction
// changes, gap-vs-jump-reach, ground-anchor checks, PLUS the new GDD §2.7
// content-variety checks: no two consecutive screens share an identical
// enemy+hazard+gimmick signature, encounter density, gimmick-through-line
// coverage) before writing the file.

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
//
// GDD §2.7 problems fixed by THIS sequence (M4.1-REBUILD), vs. the M4.1
// original:
//  - Problem 1 (repeated enemy formula): each screen below is authored as
//    one specific SITUATION, not a repeated current+bubbleCrab+urchin blend
//    - see the per-screen comments in the authoring section.
//  - Problem 2 (water gimmick vanishes after screen ~19): the gimmick
//    (valve/gate, current, or the setpiece's rising water) now touches
//    every beat from the tutorial through pre-boss, including setpiece
//    (beat 6) and finalExam (beat 8) - see GIMMICK_SCREENS below, verified
//    mechanically, not just claimed.
//  - Problem 3 (no branch & rejoin): screen 18 is a real fork (upper
//    flooded gallery / lower drained crawl) that rejoins before beat 6;
//    Body Capsule hangs off the lower route.
//  - Problem 4 (monotonic slope): the sequence below alternates far more
//    than the original - R and D interleave through beats 2-3 instead of
//    running in long blocks, and finalExam (beat 8) itself has a D-R-U-R-D
//    wiggle, not just one contiguous slope.
const SEQUENCE = [
  // Beat 1: Intro (3) - safe, sells theme, no gimmick yet (matches the GDD
  // §2.6 template's own intent - "sells the theme," not the mechanic).
  'R',
  'R',
  'D',
  // Beat 2: Gimmick tutorial (4) - valve/gate debut (harmless) + "the
  // controlled descent" (screens 5-7, three readable-landing legs).
  'R',
  'D',
  'D',
  'D',
  // Beat 3: Escalation (5) - each element taught as its OWN situation,
  // then one light 2-element combo as the beat's climax.
  'R',
  'D',
  'R',
  'D',
  'R',
  // Beat 4: Mid-boss arena (1) -> checkpoint
  'R',
  // Beat 5: Remix (6) - SECOND water variation (multi-floor layered
  // valve room) + branch & rejoin (upper flooded gallery / lower drained
  // crawl, Body Capsule off the lower route).
  'D',
  'D',
  'D',
  'R',
  'R',
  'D',
  // Beat 6: Setpiece (5) - mandatory wall-kick ASCENT SHAFT, now a genuine
  // water moment: a rising water level in the shaft's lower two legs.
  'U',
  'U',
  'U',
  'R',
  'U',
  // Beat 7: Breather (3) - calm, light gimmick touch, pickups.
  'R',
  'D',
  'R',
  // Beat 8: Final exam (5) - hardest COMBINATION (2-3 elements at once,
  // every screen), with its own up/down wiggle so the terrain isn't just
  // resuming a slope.
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
  { name: 'tutorial', count: 4 },
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
const cursor = { col: 0, row: 40 };
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
  const rowEnd = rowStart + V_COLS;
  const wallTop = rowStart - 6;
  const wallBottom = rowEnd + FILL_DEPTH;
  fillWall(cursor.col, cursor.col + 2, wallTop, wallBottom);
  fillWall(colEnd - 2, colEnd, wallTop, wallBottom);
  const ledge1Row = rowStart + 4;
  const ledge2Row = rowStart + 8;
  fillLedge(cursor.col + 2, cursor.col + 5, ledge1Row);
  fillLedge(colEnd - 5, colEnd - 2, ledge2Row);
  fillFloor(colEnd - 2, colEnd, rowEnd);
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
  const rowEnd = rowStart - V_COLS;
  const wallTop = rowEnd - 4;
  const wallBottom = rowStart + FILL_DEPTH;
  const gapWidth = 3;
  const midCol = cursor.col + Math.floor((colEnd - cursor.col) / 2);
  const leftWallEnd = midCol - Math.ceil(gapWidth / 2);
  const rightWallStart = midCol + Math.ceil(gapWidth / 2);
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
function standingY(row, entityHalfHeight = 8) {
  return row * TILE - entityHalfHeight;
}

// --- §2.7 content-signature tracking (per-screen enemy/hazard/gimmick log) --
// Built alongside placement so the consecutive-duplicate check and the
// gimmick-through-line report are computed from the SAME data that was
// actually placed, not re-derived by hand afterward.
const screenSignature = {}; // n -> { enemies: string[], hazards: string[], gimmicks: string[] }
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
tagEnemy(2, 'dartFish');

segments[3] = screenD(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 2: Gimmick tutorial (screens 4-7) - R D D D
// Screen 4: valve/gate debut (harmless pool + alcove pickup).
// Screens 5-7: "THE CONTROLLED DESCENT" - three staged, readable legs.
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[4] = s;
  const poolColStart = s.colStart + 6;
  const poolColEnd = s.colStart + 14;
  const gateRow = s.row;
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
  tagGimmick(4, 'waterValve');
}

segments[5] = screenD(cursor.col + V_COLS, cursor.row);
segments[6] = screenD(cursor.col + V_COLS, cursor.row);
// Screen 6: a light, harmless current on the second descent leg - the
// gimmick's OTHER facet debuts here, still inside the "harmless tutorial" beat.
addEntity(
  'current',
  'current-tutorial',
  tileCenterX(segments[6].ledge2.col),
  rowTopY(segments[6].ledge2.row) - 20,
  16,
  40,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -50 },
  ],
);
tagGimmick(6, 'current');
segments[7] = screenD(cursor.col + V_COLS, cursor.row);
const descentRangeStart = 5;
const descentRangeEnd = 7;

// =====================================================================
// Beat 3: Escalation (screens 8-12) - R D R D R
// Each screen is ONE situation, taught in isolation, combining only at
// the climax (screen 12) - deliberately NOT the same blend every time.
// =====================================================================
{
  // Situation A: Bubble Crab alone - teaches the bubble-pop/vulnerable cycle.
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[8] = s;
  addEntity(
    'bubbleCrab',
    'bubbleCrab-situationA',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-escalation-A',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
  tagEnemy(8, 'bubbleCrab');
}

{
  // Situation B: Toxic Urchin alone - teaches route-around avoidance in a descent.
  const s = screenD(cursor.col + V_COLS, cursor.row);
  segments[9] = s;
  addEntity(
    'toxicUrchin',
    'urchin-situationB',
    tileCenterX(s.ledge1.col),
    standingY(s.ledge1.row, 5),
    12,
    12,
  );
  tagHazard(9, 'toxicUrchin');
}

{
  // Situation C: Current alone - teaches current-assisted traversal, no enemy.
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[10] = s;
  addEntity(
    'current',
    'current-situationC',
    tileCenterX(s.colStart + 10),
    rowTopY(s.row) - 20,
    128,
    40,
    [
      { name: 'pushX', type: 'int', value: 45 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'energyPickup',
    'pickup-escalation-C',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
  tagGimmick(10, 'current');
}

{
  // Situation D: Dart Fish alone - teaches the wiggle-telegraph dash in a descent.
  const s = screenD(cursor.col + V_COLS, cursor.row);
  segments[11] = s;
  addEntity(
    'dartFish',
    'dartFish-situationD',
    tileCenterX(s.ledge2.col),
    standingY(s.ledge2.row, 5),
    16,
    16,
  );
  tagEnemy(11, 'dartFish');
}

{
  // Situation E (climax): Bubble Crab + Urchin together - the beat's first real combo.
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[12] = s;
  addEntity(
    'bubbleCrab',
    'bubbleCrab-situationE',
    tileCenterX(s.colStart + 8),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'toxicUrchin',
    'urchin-situationE',
    tileCenterX(s.colStart + 15),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity(
    'energyPickup',
    'pickup-escalation-E',
    tileCenterX(s.colStart + 18),
    standingY(s.row),
    16,
    16,
  );
  tagEnemy(12, 'bubbleCrab');
  tagHazard(12, 'toxicUrchin');
}

// =====================================================================
// Beat 4: Mid-boss arena (screen 13) -> checkpoint
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[13] = s;
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
  // A light, decorative water touch in the arena (permanently-open, no
  // valve needed) - keeps the gimmick's presence continuous through the
  // mid-boss beat too, per §2.7's through-line requirement.
  addEntity(
    'waterGate',
    'gate-midboss-decorative',
    tileCenterX(s.colStart + 17),
    rowTopY(s.row) + (5 * TILE) / 2,
    3 * TILE,
    5 * TILE,
    [{ name: 'startsOpen', type: 'bool', value: true }],
  );
  for (let c = s.colStart + 16; c < s.colStart + 19; c += 1) {
    for (let d = 0; d < 5; d += 1) cells.delete(`${s.row - 4 + d},${c}`);
  }
  addCheckpoint('checkpoint-post-midboss', 1, tileCenterX(s.colEnd - 2), standingY(s.row));
  tagGimmick(13, 'waterGate');
}

// =====================================================================
// Beat 5: Remix (screens 14-19) - D D D R R D
// SECOND water variation (3-tier layered valve room) + branch & rejoin.
// =====================================================================
segments[14] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'bubbleCrab',
  'bubbleCrab-remix-descent1',
  tileCenterX(segments[14].ledge1.col),
  standingY(segments[14].ledge1.row, 8),
  16,
  16,
);
tagEnemy(14, 'bubbleCrab');

segments[15] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-remix-descent2',
  tileCenterX(segments[15].ledge2.col),
  standingY(segments[15].ledge2.row, 5),
  16,
  16,
);
tagEnemy(15, 'dartFish');

// Screen 16: multi-floor valve room - 3 stacked tiers, 2 valves/gates.
// This is the SECOND, distinctly different water variation (a genuine
// layer-choice room), not a repeat of screen 4's single simple pool.
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
    'bubbleCrab',
    'bubbleCrab-multifloor-bottom',
    tileCenterX(colEnd - 5),
    standingY(botRow, 8),
    16,
    16,
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
    tileCenterX(colStart + 4),
    standingY(botRow),
    16,
    16,
  );
  segments[16] = {
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
  tagGimmick(16, 'waterValve');
  tagEnemy(16, 'bubbleCrab');
}

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[17] = s;
  addEntity(
    'dartFish',
    'dartFish-remix-connector',
    tileCenterX(s.colStart + 12),
    standingY(s.row, 5),
    16,
    16,
  );
  tagEnemy(17, 'dartFish');
}

// Screen 18: BRANCH & REJOIN (GDD §3.2 problem 3) - upper flooded gallery
// (currents + pickups) vs lower drained maintenance crawl (safe, slow);
// Body Capsule pump shaft hangs off the LOWER route. Rejoins before beat 6.
let branchForkScreen;
let branchRejoinScreen;
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS;
  const lowerRow = cursor.row;
  const upperRow = cursor.row - 3;
  fillFloor(colStart, colEnd, lowerRow);
  fillFloor(colStart + 2, colEnd - 6, upperRow, 3);
  fillWall(colStart, colStart + 2, upperRow, lowerRow + FILL_DEPTH);

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

  segments[18] = {
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
  branchForkScreen = 18;
  branchRejoinScreen = 18; // both bands live in this one screen and rejoin at its right edge, before screen 19
  tagGimmick(18, 'current');
  tagEnemy(18, 'bubbleCrab');
  tagHazard(18, 'toxicUrchin');
}

segments[19] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'toxicUrchin',
  'urchin-remix-end',
  tileCenterX(segments[19].ledge2.col),
  standingY(segments[19].ledge2.row, 5),
  12,
  12,
);
tagHazard(19, 'toxicUrchin');

// =====================================================================
// Beat 6: Setpiece (screens 20-24) - U U U R U
// Mandatory wall-kick ASCENT SHAFT, now a genuine water moment: a rising
// water level fills the shaft's lower two legs once triggered.
// =====================================================================
const ascentShaftColStart = cursor.col;
segments[20] = screenU(cursor.col + V_COLS, cursor.row);
addEntity(
  'bubbleCrab',
  'bubbleCrab-shaft-lower',
  tileCenterX(segments[20].colStart + 2),
  standingY(segments[20].rowEnter),
  16,
  16,
);
tagEnemy(20, 'bubbleCrab');

segments[21] = screenU(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-shaft-water',
  tileCenterX(segments[21].colEnd - 2),
  standingY(segments[21].rowExit),
  16,
  16,
);
tagEnemy(21, 'dartFish');

// The rising-water zone spans screens 20-21 (bottom two legs), capping at
// the top of screen 21 - screen 22 and above stay dry.
addEntity(
  'risingWaterZone',
  'risingWater-ascentShaft',
  tileCenterX((ascentShaftColStart + segments[21].colEnd) / 2),
  rowTopY(segments[21].rowExit),
  (segments[21].gap.right - segments[20].gap.left) * TILE,
  0,
  [
    { name: 'bottomRow', type: 'int', value: segments[20].rowEnter },
    { name: 'ceilingRow', type: 'int', value: segments[21].rowExit },
  ],
);
tagGimmick(20, 'risingWater');
tagGimmick(21, 'risingWater');

segments[22] = screenU(cursor.col + V_COLS, cursor.row);
addEntity(
  'bubbleCrab',
  'bubbleCrab-shaft-dry',
  tileCenterX(segments[22].colStart + 2),
  standingY(segments[22].rowEnter),
  16,
  16,
);
tagEnemy(22, 'bubbleCrab');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[23] = s;
  addEntity(
    'toxicUrchin',
    'urchin-shaft-plateau',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 5),
    12,
    12,
  );
  addEntity(
    'energyPickup',
    'pickup-shaft-plateau',
    tileCenterX(s.colStart + 15),
    standingY(s.row),
    16,
    16,
  );
  tagHazard(23, 'toxicUrchin');
}

segments[24] = screenU(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-shaft-top',
  tileCenterX(segments[24].colStart + 2),
  standingY(segments[24].rowEnter),
  16,
  16,
);
tagEnemy(24, 'dartFish');
const ascentShaftColEnd = cursor.col;

const ascentShaftTopRow = segments[24].rowExit - 4;
const ascentShaftBottomRow = segments[20].rowEnter + 6;
addEntity(
  'ascentShaftZone',
  'elevatorAscentShaftZone',
  tileCenterX((ascentShaftColStart + ascentShaftColEnd) / 2),
  rowTopY((ascentShaftTopRow + ascentShaftBottomRow) / 2),
  (ascentShaftColEnd - ascentShaftColStart) * TILE,
  (ascentShaftBottomRow - ascentShaftTopRow) * TILE,
);
addCheckpoint(
  'checkpoint-post-setpiece',
  2,
  tileCenterX(segments[24].colEnd - 4),
  standingY(segments[24].row),
);

// =====================================================================
// Beat 7: Breather (screens 25-27) - R D R
// Calm, but still touches the gimmick (light current) - not gimmick-dark.
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[25] = s;
  addEntity(
    'current',
    'current-breather',
    tileCenterX(s.colStart + 10),
    rowTopY(s.row) - 16,
    96,
    32,
    [
      { name: 'pushX', type: 'int', value: 30 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
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
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
  tagGimmick(25, 'current');
}

segments[26] = screenD(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-breather-dip',
  tileCenterX(segments[26].ledge2.col),
  standingY(segments[26].ledge2.row, 5),
  16,
  16,
);
addEntity(
  'energyPickup',
  'pickup-breather-dip',
  tileCenterX(segments[26].ledge1.col),
  standingY(segments[26].ledge1.row),
  16,
  16,
);
tagEnemy(26, 'dartFish');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[27] = s;
  addEntity(
    'energyPickup',
    'pickup-breather-3',
    tileCenterX(s.colStart + 10),
    standingY(s.row),
    16,
    16,
  );
}

// =====================================================================
// Beat 8: Final exam (screens 28-32) - D R U R D
// Hardest COMBINATION - every screen layers 2-3 already-taught elements
// at once, distinct in texture from escalation's one-at-a-time teaching.
// =====================================================================
{
  // Situation A: current-boosted Bubble Crab gauntlet.
  const s = screenD(cursor.col + V_COLS, cursor.row);
  segments[28] = s;
  addEntity(
    'current',
    'current-exam-A',
    tileCenterX(s.ledge1.col),
    rowTopY(s.ledge1.row) - 20,
    16,
    40,
    [
      { name: 'pushX', type: 'int', value: 0 },
      { name: 'pushY', type: 'int', value: -55 },
    ],
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-exam-A',
    tileCenterX(s.ledge2.col),
    standingY(s.ledge2.row, 8),
    16,
    16,
  );
  tagGimmick(28, 'current');
  tagEnemy(28, 'bubbleCrab');
}

{
  // Situation B: Dart Fish ambush mid-current, with an urchin on the landing - the densest screen.
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[29] = s;
  addEntity('current', 'current-exam-B', tileCenterX(s.colStart + 8), rowTopY(s.row) - 16, 96, 32, [
    { name: 'pushX', type: 'int', value: 35 },
    { name: 'pushY', type: 'int', value: 0 },
  ]);
  addEntity(
    'dartFish',
    'dartFish-exam-B',
    tileCenterX(s.colStart + 12),
    standingY(s.row, 5),
    16,
    16,
  );
  addEntity(
    'toxicUrchin',
    'urchin-exam-B',
    tileCenterX(s.colStart + 17),
    standingY(s.row, 5),
    12,
    12,
  );
  tagGimmick(29, 'current');
  tagEnemy(29, 'dartFish');
  tagHazard(29, 'toxicUrchin');
}

{
  // Situation C: wall-kick + current skill check - reuses the ascent skill, no enemy.
  const s = screenU(cursor.col + V_COLS, cursor.row);
  segments[30] = s;
  addEntity(
    'current',
    'current-exam-C',
    tileCenterX((s.gap.left + s.gap.right) / 2),
    rowTopY(s.rowEnter - 6),
    (s.gap.right - s.gap.left) * TILE,
    40,
    [
      { name: 'pushX', type: 'int', value: 0 },
      { name: 'pushY', type: 'int', value: -50 },
    ],
  );
  tagGimmick(30, 'current');
}

{
  // Situation D: double Bubble Crab pincer over an urchin floor - the first double-enemy screen.
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[31] = s;
  addEntity(
    'bubbleCrab',
    'bubbleCrab-exam-D1',
    tileCenterX(s.colStart + 6),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-exam-D2',
    tileCenterX(s.colStart + 15),
    standingY(s.row, 8),
    16,
    16,
  );
  addEntity(
    'toxicUrchin',
    'urchin-exam-D',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 5),
    12,
    12,
  );
  tagEnemy(31, 'bubbleCrab');
  tagEnemy(31, 'bubbleCrab');
  tagHazard(31, 'toxicUrchin');
}

{
  // Situation E: valve-gated urchin drop - the recurring water gimmick reused for a final puzzle-combo.
  const s = screenD(cursor.col + V_COLS, cursor.row);
  segments[32] = s;
  const gateColStart = s.colStart + 4;
  const gateColEnd = s.colStart + 8;
  const gateRow = s.rowEnter + 3;
  for (let c = gateColStart; c < gateColEnd; c += 1) {
    for (let d = 0; d <= 4; d += 1) cells.delete(`${gateRow + d},${c}`);
  }
  addEntity(
    'waterValve',
    'valve-exam-E',
    tileCenterX(s.colStart + 1),
    standingY(s.rowEnter),
    10,
    16,
    [{ name: 'targetGate', type: 'string', value: 'gate-exam-E' }],
  );
  addEntity(
    'waterGate',
    'gate-exam-E',
    tileCenterX((gateColStart + gateColEnd) / 2),
    rowTopY(gateRow) + (5 * TILE) / 2,
    (gateColEnd - gateColStart) * TILE,
    5 * TILE,
    [{ name: 'startsOpen', type: 'bool', value: false }],
  );
  addEntity(
    'toxicUrchin',
    'urchin-exam-E',
    tileCenterX((gateColStart + gateColEnd) / 2),
    standingY(gateRow + 4, 5),
    12,
    12,
  );
  addEntity(
    'energyPickup',
    'pickup-exam-E',
    tileCenterX(s.colEnd - 3),
    standingY(s.rowExit),
    16,
    16,
  );
  tagGimmick(32, 'waterValve');
  tagHazard(32, 'toxicUrchin');
}

// =====================================================================
// Beat 9: Pre-boss corridor (screens 33-34) -> checkpoint -> boss room
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[33] = s;
  addEntity(
    'current',
    'current-preboss',
    tileCenterX(s.colStart + 10),
    rowTopY(s.row) - 16,
    96,
    32,
    [
      { name: 'pushX', type: 'int', value: 30 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'energyPickup',
    'pickup-preboss-1',
    tileCenterX(s.colStart + 6),
    standingY(s.row),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-preboss-2',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
  tagGimmick(33, 'current');
}

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[34] = s;
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
// Placement validation (ground-anchor check, unchanged methodology)
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
// GDD §2.7 content-variety validation (mechanical, not eyeballed)
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

const regularEnemyTypes = new Set(['dartFish', 'bubbleCrab']);
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
if (density < 1.4 || density > 2.1) {
  throw new Error(
    `density ${density.toFixed(2)} outside the 1.5-2.0 target band (with small tolerance)`,
  );
}
console.log('Encounters per beat:', JSON.stringify(encountersPerBeat));

const gimmickScreens = [];
for (let n = 1; n <= SEQUENCE.length; n += 1) {
  if (screenSignature[n] && screenSignature[n].gimmicks.length > 0) gimmickScreens.push(n);
}
console.log(
  'Gimmick-usage screens (waterValve/current/risingWater):',
  JSON.stringify(gimmickScreens),
);
const beatsWithGimmick = new Set(gimmickScreens.map((n) => screenToBeat[n - 1]));
console.log(
  'Beats touched by the gimmick:',
  JSON.stringify([...beatsWithGimmick].sort((a, b) => a - b)),
);
if (!beatsWithGimmick.has(6))
  throw new Error('setpiece (beat 6) has no gimmick usage - problem 2 not fixed');
if (!beatsWithGimmick.has(8))
  throw new Error('finalExam (beat 8) has no gimmick usage - problem 2 not fixed');

// =====================================================================
// ASCII route map (mechanically derived from the actual segment log)
// =====================================================================
console.log('Map size:', width, 'x', height, 'tiles =', width * TILE, 'x', height * TILE, 'px');
console.log('Total screens:', SEQUENCE.length);
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

console.log('\nPer-screen surface row (tiles, raw generator baseline before ROW_MARGIN offset):');
console.log(
  JSON.stringify(
    segments.slice(1).map((s, i) => ({
      screen: i + 1,
      tag: SEQUENCE[i],
      rowEnter: s.rowEnter,
      rowExit: s.rowExit,
    })),
  ),
);

console.log(`\nControlled DESCENT range: screens ${descentRangeStart}-${descentRangeEnd}`);
console.log(`ASCENT SHAFT range: screens 20-24 (rising water active 20-21, dry 22-24)`);
console.log(`MULTI-FLOOR ROOM: screen 16`);
console.log(
  `BRANCH & REJOIN: screen ${branchForkScreen} (fork and rejoin both within this screen's column span)`,
);

const outPath = process.argv[2] || 'reservoir.json';
fs.writeFileSync(outPath, JSON.stringify(map));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
