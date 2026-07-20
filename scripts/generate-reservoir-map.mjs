// Generator for Coral Reservoir's Tiled JSON map (GDD §2.6/§2.7/§3.2,
// M4.1-REBUILD-2). Previous attempt reused the same 3 generic screenR/D/U
// templates everywhere and only reordered which enemies sat in which
// screen - the raw ground layer barely changed (confirmed by an
// independent tile-level audit) and was correctly rejected. THIS version
// re-authors the ground geometry itself: new distinct screen shapes
// (staircase, sheer-drop, in addition to the existing flat/chute/wall-kick
// shaft), a genuinely taller multi-screen ascent shaft, a genuinely wider
// 2-screen branch, and a real vertical/horizontal-count change from every
// prior version so the terrain can't coincidentally land on the same
// absolute rows as before. Mechanical validation (axis-mix %, run-length,
// direction changes, ground-anchor placement, GDD §2.7 content-variety AND
// a new motif-repetition check) all still gate the build.

import fs from 'node:fs';

const TILE = 16;
const H_COLS = 20; // horizontal screen width, tiles (320px, GDD §2.6's native-view screen)
const V_COLS = 12; // vertical screen width/height unit, tiles (192px)
const FILL_DEPTH = 10;
const EMPTY = 0;
const FILL = 1; // GID 1: bulk fill tile
const TOP = 2; // GID 2: floor-top tile

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
// Each entry is { dir: 'R'|'D'|'U', motif: string } - `dir` drives the
// GDD §2.6 axis-mix/run-length/direction-change stats (unchanged rule);
// `motif` is the NEW §2.7 content-variety axis: the actual ground SHAPE
// used, tracked separately so "no more than 3 consecutive screens share
// the same ledge/gap pattern" is checked directly against what was
// actually built, not inferred from `dir` alone (two 'D' screens can have
// completely different motifs, e.g. stair vs sheer-drop vs chute).
const PLAN = [
  // Beat 1: Intro (3)
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'chute' },
  // Beat 2: Gimmick tutorial (4) - valve debut + THE CONTROLLED DESCENT
  // (screens 5-7): a 4-step staircase, a distinctly different rhythm from
  // the zigzag chute used elsewhere - gentle, no gaps, pure walk-and-drop.
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'stair' },
  { dir: 'D', motif: 'stair' },
  { dir: 'D', motif: 'stair' },
  // Beat 3: Escalation (5) - situations taught in isolation; only ONE
  // uses a descent shape (dartFish), the others stay flat so the beat
  // doesn't just repeat the tutorial's stair rhythm.
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'chute' },
  { dir: 'R', motif: 'flat' },
  // Beat 4: Mid-boss (1)
  { dir: 'R', motif: 'flat' },
  // Beat 5: Remix (6) - MULTI-FLOOR ROOM built as real stacked floor
  // geometry (2 screen-slots = 2 real 12-tile gaps between 3 tiers), a
  // genuinely 2-screen-wide BRANCH (not 1), then a short link into setpiece.
  { dir: 'D', motif: 'multiFloor' },
  { dir: 'D', motif: 'multiFloor' },
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'branch' },
  { dir: 'R', motif: 'branch' },
  { dir: 'D', motif: 'sheer' },
  // Beat 6: Setpiece (7) - the ASCENT SHAFT, now 6 full wall-kick legs
  // (72 tiles of real climb) with a plateau breaking the run at the cap.
  { dir: 'U', motif: 'shaft' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'U', motif: 'shaft' },
  // Beat 7: Breather (3)
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  // Beat 8: Final exam (5) - hardest combination, its own up/down wiggle.
  { dir: 'D', motif: 'sheer' },
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'chute' },
  // Beat 9: Pre-boss (2)
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
];

const SEQUENCE = PLAN.map((p) => p.dir);
const MOTIFS = PLAN.map((p) => p.motif);

const BEATS = [
  { name: 'intro', count: 3 },
  { name: 'tutorial', count: 4 },
  { name: 'escalation', count: 5 },
  { name: 'midboss', count: 1 },
  { name: 'remix', count: 6 },
  { name: 'setpiece', count: 7 },
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

// --- Route-shape validation (GDD §2.6, unchanged rule) ---------------------
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
if (stats.total < 28 || stats.total > 36)
  throw new Error(`screen count ${stats.total} outside 28-36`);
if (stats.verticalPct < 35) throw new Error(`vertical% ${stats.verticalPct} below 35`);
if (stats.maxRun > 3) throw new Error(`max same-direction run ${stats.maxRun} exceeds 3`);
if (stats.changes < 4) throw new Error(`direction changes ${stats.changes} below 4`);

// --- NEW: motif-repetition validation (GDD §2.7 problem: "same repeated ledge/gap motif") ---
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

// --- Screen-by-screen authoring: NEW distinct ground-shape primitives ------
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

/** motif 'chute': the original 2-ledge zigzag descent (offset ledges, left then right). */
function screenDChute(colEnd, rowStart) {
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  // Each backstop wall starts exactly at its OWN floor's row, not above it -
  // a wall starting higher than the row the player is already standing on
  // (entering from the previous screen at rowStart) blocks the flat walk-in
  // entirely, since Arcade collision doesn't care whether a solid tile is
  // FILL or TOP (setCollisionByExclusion([-1])). Confirmed via a raw-tile +
  // live-browser check that this buried every vertical screen's entry/exit
  // in both the pre-rebuild baseline and this rebuild.
  fillWall(cursor.col, cursor.col + 2, rowStart, wallBottom);
  fillWall(colEnd - 2, colEnd, rowEnd, wallBottom);
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

/** motif 'stair': a solid 4-step staircase, no gaps - a distinctly gentler, more granular rhythm than the chute. THE CONTROLLED DESCENT feature. */
function screenDStair(colEnd, rowStart) {
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  // See screenDChute: backstops start at their own floor's row, not above it.
  fillWall(cursor.col, cursor.col + 1, rowStart, wallBottom);
  fillWall(colEnd - 1, colEnd, rowEnd, wallBottom);
  const innerStart = cursor.col + 1;
  const innerEnd = colEnd - 1;
  const stepCols = Math.floor((innerEnd - innerStart) / 4);
  const stepRows = V_COLS / 4; // 3 tiles per step
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

/** motif 'sheer': entry -> one big 8-tile fall -> one mid landing -> a 4-tile fall to the floor. Steeper, fewer stops than the chute. */
function screenDSheer(colEnd, rowStart) {
  const rowMid = rowStart + 8;
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  // See screenDChute: backstops start at their own floor's row, not above it.
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

/** motif 'shaft': wall-kick ascent leg, 3-tile gap (Speedway-bugfix-proven safe width). */
function screenUShaft(colEnd, rowStart) {
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

segments[3] = screenDChute(cursor.col + V_COLS, cursor.row);

// =====================================================================
// Beat 2: Gimmick tutorial (4-7) - valve debut + THE CONTROLLED DESCENT (stair, 5-7)
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

const descentRangeStart = 5;
segments[5] = screenDStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'energyPickup',
  'pickup-stair-1',
  tileCenterX(segments[5].treads[1].col),
  standingY(segments[5].treads[1].row),
  16,
  16,
);

segments[6] = screenDStair(cursor.col + V_COLS, cursor.row);
addEntity(
  'current',
  'current-tutorial',
  tileCenterX(segments[6].treads[2].col),
  rowTopY(segments[6].treads[2].row) - 20,
  16,
  40,
  [
    { name: 'pushX', type: 'int', value: 0 },
    { name: 'pushY', type: 'int', value: -45 },
  ],
);
tagGimmick(6, 'current');

segments[7] = screenDStair(cursor.col + V_COLS, cursor.row);
const descentRangeEnd = 7;

// =====================================================================
// Beat 3: Escalation (8-12) - each situation taught in isolation
// =====================================================================
{
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
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[9] = s;
  addEntity(
    'toxicUrchin',
    'urchin-situationB',
    tileCenterX(s.colStart + 9),
    standingY(s.row, 5),
    12,
    12,
  );
  tagHazard(9, 'toxicUrchin');
}
{
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
  const s = screenDChute(cursor.col + V_COLS, cursor.row);
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
// Beat 4: Mid-boss arena (13) -> checkpoint
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
// Beat 5: Remix (14-19) - REAL multi-floor room (2 gaps = 2 screen-slots,
// 3 tiers) + a genuinely 2-screen-wide branch + short link into setpiece.
// =====================================================================
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS;
  const topRow = cursor.row;
  const midRow = topRow + V_COLS;
  const botRow = topRow + V_COLS * 2;
  fillWall(colStart, colStart + 2, topRow - 4, botRow + FILL_DEPTH);
  fillWall(colEnd - 2, colEnd, topRow - 4, botRow + FILL_DEPTH);
  fillFloor(colStart + 2, colEnd - 2, topRow, 0);
  fillFloor(colStart + 2, colEnd - 2, midRow, 0);
  fillFloor(colStart + 2, colEnd - 2, botRow);
  const gateAColStart = colStart + 8;
  const gateAColEnd = colStart + 13;
  const gateBColStart = colStart + 8;
  const gateBColEnd = colStart + 13;
  for (let c = gateAColStart; c < gateAColEnd; c += 1) {
    for (let r = topRow; r < midRow; r += 1) cells.delete(`${r},${c}`);
  }
  for (let c = gateBColStart; c < gateBColEnd; c += 1) {
    for (let r = midRow; r < botRow; r += 1) cells.delete(`${r},${c}`);
  }
  addEntity(
    'waterValve',
    'valve-multifloor-A',
    tileCenterX(colStart + 4),
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
    tileCenterX(colStart + 4),
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
  segments[14] = {
    colStart,
    colEnd,
    row: midRow,
    rowEnter: topRow,
    rowExit: midRow,
    topRow,
    midRow,
    botRow,
  };
  segments[15] = {
    colStart,
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
  tagGimmick(14, 'waterValve');
  tagGimmick(15, 'waterValve');
  tagEnemy(15, 'bubbleCrab');
}

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[16] = s;
  addEntity(
    'dartFish',
    'dartFish-remix-connector',
    tileCenterX(s.colStart + 12),
    standingY(s.row, 5),
    16,
    16,
  );
  tagEnemy(16, 'dartFish');
}

// Screens 17-18: BRANCH & REJOIN spans a genuinely 2-screen-wide (40-tile)
// span - upper flooded gallery / lower drained crawl are each a real,
// substantial, continuous path across both screens, not a single-screen
// dual-band decoration.
let branchForkScreen;
let branchRejoinScreen;
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS * 2;
  const lowerRow = cursor.row;
  const upperRow = cursor.row - 3;
  fillFloor(colStart, colEnd, lowerRow);
  // depth=0: upperRow is only 3 rows above lowerRow, so a nonzero fill depth
  // here would bury the lower crawl's headroom/surface in solid ground (the
  // same trap the multi-floor room's topRow/midRow fills avoid). The open
  // rows between upperRow and lowerRow are what make this a genuine
  // two-band branch instead of one solid block with a ledge on top.
  fillFloor(colStart + 2, colEnd - 8, upperRow, 0);
  fillWall(colStart, colStart + 2, upperRow, lowerRow + FILL_DEPTH);

  addEntity(
    'current',
    'current-branch-upper-1',
    tileCenterX(colStart + 8),
    rowTopY(upperRow) - 10,
    96,
    20,
    [
      { name: 'pushX', type: 'int', value: 40 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'current',
    'current-branch-upper-2',
    tileCenterX(colStart + 26),
    rowTopY(upperRow) - 10,
    96,
    20,
    [
      { name: 'pushX', type: 'int', value: 40 },
      { name: 'pushY', type: 'int', value: 0 },
    ],
  );
  addEntity(
    'bubbleCrab',
    'bubbleCrab-branch-upper-1',
    tileCenterX(colStart + 12),
    standingY(upperRow, 8),
    16,
    16,
  );
  addEntity(
    'dartFish',
    'dartFish-branch-upper-2',
    tileCenterX(colStart + 30),
    standingY(upperRow, 5),
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
    tileCenterX(colStart + 20),
    standingY(upperRow),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-branch-upper-3',
    tileCenterX(colStart + 29),
    standingY(upperRow),
    16,
    16,
  );

  addEntity(
    'toxicUrchin',
    'urchin-branch-lower-1',
    tileCenterX(colStart + 10),
    standingY(lowerRow, 5),
    12,
    12,
  );
  addEntity(
    'toxicUrchin',
    'urchin-branch-lower-2',
    tileCenterX(colStart + 28),
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

  segments[17] = {
    colStart,
    colEnd: colStart + H_COLS,
    row: lowerRow,
    rowEnter: lowerRow,
    rowExit: lowerRow,
    upperRow,
    lowerRow,
  };
  segments[18] = {
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
  branchForkScreen = 17;
  branchRejoinScreen = 18;
  tagGimmick(17, 'current');
  tagEnemy(17, 'bubbleCrab');
  tagHazard(17, 'toxicUrchin');
  tagGimmick(18, 'current');
  tagEnemy(18, 'dartFish');
  tagHazard(18, 'toxicUrchin');
}

segments[19] = screenDSheer(cursor.col + V_COLS, cursor.row);
addEntity(
  'toxicUrchin',
  'urchin-remix-end',
  tileCenterX(segments[19].ledge1.col),
  standingY(segments[19].ledge1.row, 5),
  12,
  12,
);
tagHazard(19, 'toxicUrchin');

// =====================================================================
// Beat 6: Setpiece (20-26) - ASCENT SHAFT, 6 real wall-kick legs (72
// tiles), a plateau breaking the run at the cap. Rising water in legs 1-2.
// =====================================================================
const ascentShaftColStart = cursor.col;
segments[20] = screenUShaft(cursor.col + V_COLS, cursor.row);
addEntity(
  'bubbleCrab',
  'bubbleCrab-shaft-lower',
  tileCenterX(segments[20].colStart + 2),
  standingY(segments[20].rowEnter),
  16,
  16,
);
tagEnemy(20, 'bubbleCrab');

segments[21] = screenUShaft(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-shaft-water',
  tileCenterX(segments[21].colEnd - 2),
  standingY(segments[21].rowExit),
  16,
  16,
);
tagEnemy(21, 'dartFish');

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

segments[22] = screenUShaft(cursor.col + V_COLS, cursor.row);
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

segments[24] = screenUShaft(cursor.col + V_COLS, cursor.row);
addEntity(
  'dartFish',
  'dartFish-shaft-top1',
  tileCenterX(segments[24].colStart + 2),
  standingY(segments[24].rowEnter),
  16,
  16,
);
tagEnemy(24, 'dartFish');

segments[25] = screenUShaft(cursor.col + V_COLS, cursor.row);
addEntity(
  'bubbleCrab',
  'bubbleCrab-shaft-top2',
  tileCenterX(segments[25].colEnd - 2),
  standingY(segments[25].rowExit),
  16,
  16,
);
tagEnemy(25, 'bubbleCrab');

segments[26] = screenUShaft(cursor.col + V_COLS, cursor.row);
const ascentShaftColEnd = cursor.col;

const ascentShaftTopRow = segments[26].rowExit - 4;
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
  tileCenterX(segments[26].colEnd - 4),
  standingY(segments[26].row),
);
const ascentRangeStart = 20;
const ascentRangeEnd = 26;

// =====================================================================
// Beat 7: Breather (27-29)
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[27] = s;
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
  tagGimmick(27, 'current');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[28] = s;
  addEntity(
    'dartFish',
    'dartFish-breather',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 5),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-breather-3',
    tileCenterX(s.colStart + 16),
    standingY(s.row),
    16,
    16,
  );
  tagEnemy(28, 'dartFish');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[29] = s;
  addEntity(
    'energyPickup',
    'pickup-breather-4',
    tileCenterX(s.colStart + 10),
    standingY(s.row),
    16,
    16,
  );
}

// =====================================================================
// Beat 8: Final exam (30-34) - hardest COMBINATION, its own D-R-U-R-D wiggle.
// =====================================================================
{
  const s = screenDSheer(cursor.col + V_COLS, cursor.row);
  segments[30] = s;
  addEntity(
    'current',
    'current-exam-A',
    tileCenterX(s.colStart + 4),
    rowTopY(s.colStart) - 20,
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
    tileCenterX(s.ledge1.col),
    standingY(s.ledge1.row, 8),
    16,
    16,
  );
  tagGimmick(30, 'current');
  tagEnemy(30, 'bubbleCrab');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[31] = s;
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
  tagGimmick(31, 'current');
  tagEnemy(31, 'dartFish');
  tagHazard(31, 'toxicUrchin');
}
{
  const s = screenUShaft(cursor.col + V_COLS, cursor.row);
  segments[32] = s;
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
  tagGimmick(32, 'current');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[33] = s;
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
  tagEnemy(33, 'bubbleCrab');
  tagEnemy(33, 'bubbleCrab');
  tagHazard(33, 'toxicUrchin');
}
{
  const s = screenDChute(cursor.col + V_COLS, cursor.row);
  segments[34] = s;
  const gateColStart = s.colStart + 4;
  const gateColEnd = s.colStart + 8;
  const gateRow = s.rowEnter + 4;
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
  tagGimmick(34, 'waterValve');
  tagHazard(34, 'toxicUrchin');
}

// =====================================================================
// Beat 9: Pre-boss corridor (35-36) -> checkpoint -> boss room
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[35] = s;
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
  tagGimmick(35, 'current');
}
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[36] = s;
  addCheckpoint('checkpoint-preboss', 3, tileCenterX(s.colStart + 2), standingY(s.row));
  addEntity('bossDoor', 'bossDoor', tileCenterX(s.colEnd - 2), rowTopY(s.row - 8), 16, 128);
}

// =====================================================================
// Boss room (appended after the counted path, same convention as Speedway)
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
    if (s.topRow !== undefined) rows.push(s.topRow, s.midRow, s.botRow);
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
if (density < 1.4 || density > 2.1)
  throw new Error(`density ${density.toFixed(2)} outside the 1.5-2.0 target band`);
console.log('Encounters per beat:', JSON.stringify(encountersPerBeat));

const gimmickScreens = [];
for (let n = 1; n <= SEQUENCE.length; n += 1)
  if (screenSignature[n] && screenSignature[n].gimmicks.length > 0) gimmickScreens.push(n);
console.log('Gimmick-usage screens:', JSON.stringify(gimmickScreens));
const beatsWithGimmick = new Set(gimmickScreens.map((n) => screenToBeat[n - 1]));
console.log(
  'Beats touched by the gimmick:',
  JSON.stringify([...beatsWithGimmick].sort((a, b) => a - b)),
);
if (!beatsWithGimmick.has(6)) throw new Error('setpiece (beat 6) has no gimmick usage');
if (!beatsWithGimmick.has(8)) throw new Error('finalExam (beat 8) has no gimmick usage');

// =====================================================================
// Route map + full report
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
      motif: MOTIFS[i],
      rowEnter: s.rowEnter,
      rowExit: s.rowExit,
    })),
  ),
);

console.log(
  `\nControlled DESCENT range: screens ${descentRangeStart}-${descentRangeEnd} (motif: stair)`,
);
console.log(
  `ASCENT SHAFT range: screens ${ascentRangeStart}-${ascentRangeEnd} (6 wall-kick legs, motif: shaft; rising water active legs 1-2)`,
);
console.log(`MULTI-FLOOR ROOM: screens 14-15 (2 real 12-tile gaps between 3 tiers)`);
console.log(
  `BRANCH & REJOIN: screens ${branchForkScreen}-${branchRejoinScreen} (2-screen-wide, 40 tiles, upper/lower both continuous)`,
);

const outPath = process.argv[2] || 'reservoir.json';
fs.writeFileSync(outPath, JSON.stringify(map));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
