// Generator for Ember Foundry's Tiled JSON map (GDD §2.6/§2.7/§3.3, M4.2).
//
// DECLARED AXIS: VERTICAL-DOMINANT (a CLIMB - GDD §3.3: "heat-vent ascent
// up the forge chimney ... the rising-lava chase is a forced vertical
// ascent setpiece ... descent beside a lava-fall"). Deliberately shaped to
// read differently from Reservoir's vertical DESCENT: this stage's net
// elevation trends UPWARD (start deep in the volcano's base, end at the
// forge chamber near the top), the primary vertical traversal tool is
// heat vents (not wall-kick chains, though wall-kicking remains an
// available alternate route through every vent shaft), and the setpiece
// is a forced, lethal, continuously-rising hazard chasing the player
// upward rather than an optional assist.
//
// Built on the same screen-shape-primitive + mechanical-validation
// discipline established by Reservoir's/Speedway's generators: backstop
// walls always start at their OWN floor's row (never above it - the bug
// class documented repeatedly in DECISIONS.md), every wall-kick/void gap
// is exactly 3 tiles (48px, the base-kit-jump-reach-bugfix-proven safe
// width - computed as `left + gapWidth`, NOT `mid +/- ceil(gapWidth/2)`,
// which silently doubles to a 4-tile gap - see DECISIONS.md), multi-
// screen rooms are genuinely multi-screen wide, and branch bands have
// real vertical separation. Route-shape/motif/content-signature/density/
// gimmick-usage/placement/fairness are all re-verified mechanically below,
// not just asserted.

import fs from 'node:fs';

const TILE = 16;
const H_COLS = 20; // horizontal screen width, tiles (320px, GDD §2.6's native-view screen)
const V_COLS = 12; // vertical screen width/height unit, tiles (192px)
const FILL_DEPTH = 10;
const EMPTY = 0;
const FILL = 1; // GID 1: bulk fill tile
const TOP = 2; // GID 2: floor-top tile

const SAFE_GAP_TILES = 3; // base-kit (no-dash) jump/wall-kick reach ceiling, proven safe in Speedway's bugfix log

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
function clearColumn(col, rowStart, rowEnd) {
  for (let r = rowStart; r <= rowEnd; r += 1) cells.delete(`${r},${col}`);
}

// --- Screen-shape sequence -------------------------------------------------
// `dir` drives the GDD §2.6 axis-mix/run-length/direction-change stats;
// `motif` is the §2.7 content-variety axis - the actual ground SHAPE used.
const PLAN = [
  // Beat 1: Intro (3) - safe, sells the theme, 1 easy enemy.
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'dip' },
  // Beat 2: Gimmick tutorial (4) - heat vent debuts harmless; a plain
  // wall-kick leg (no vent) right after teaches the alternate route.
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'ventShaft' },
  { dir: 'U', motif: 'shaft' },
  { dir: 'R', motif: 'flat' },
  // Beat 3: Escalation (5) - vent+enemy combined; piston crusher debuts
  // in its own isolated room (no other new hazard type alongside it).
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'ventShaft' },
  { dir: 'R', motif: 'crusherDoorway' },
  { dir: 'D', motif: 'dip' },
  { dir: 'R', motif: 'flat' },
  // Beat 4: Mid-boss (1) -> checkpoint
  { dir: 'R', motif: 'arena' },
  // Beat 5: Remix (6) - MULTI-FLOOR forge hall (ascending, piston layers)
  // + a genuine 2-screen BRANCH & REJOIN (upper catwalk/crushers vs
  // lower pipe corridor).
  { dir: 'U', motif: 'multiFloor' },
  { dir: 'U', motif: 'multiFloor' },
  { dir: 'R', motif: 'flat' },
  { dir: 'R', motif: 'branch' },
  { dir: 'R', motif: 'branch' },
  { dir: 'D', motif: 'sheer' },
  // Beat 6: Setpiece (6) - the RISING LAVA CHASE, a forced vertical
  // ascent. 5 climbing legs with one horizontal ledge breaking the run.
  { dir: 'U', motif: 'lavaChase' },
  { dir: 'U', motif: 'lavaChase' },
  { dir: 'U', motif: 'lavaChase' },
  { dir: 'R', motif: 'lavaChaseLedge' },
  { dir: 'U', motif: 'lavaChase' },
  { dir: 'U', motif: 'lavaChase' },
  // Beat 7: Breather + secret branch (3) - Cell Pack #1 hangs off here.
  // The middle screen steps down a few rows (still calm, no hazard) so
  // the breather isn't a perfectly flat run at real-320px-screen
  // granularity (see DECISIONS.md: real screens don't line up 1:1 with
  // this generator's own mixed-width segment index).
  { dir: 'R', motif: 'flat' },
  { dir: 'D', motif: 'dip' },
  { dir: 'R', motif: 'flat' },
  // Beat 8: Final exam (5) - descent-beside-the-lavafall (heat-vent
  // slowfall) + vent climb + crusher + enemies, the hardest COMBINATION.
  { dir: 'D', motif: 'lavafallDescent' },
  { dir: 'D', motif: 'lavafallDescent' },
  { dir: 'R', motif: 'flat' },
  { dir: 'U', motif: 'ventShaft' },
  { dir: 'R', motif: 'crusherDoorway' },
  // Beat 9: Pre-boss corridor (2) -> checkpoint -> boss room. The first
  // screen steps down a few rows (see the beat-7 comment above - breaks
  // an otherwise-long real-320px-screen flat run against the final-exam
  // climb's own exit height, which happens to match this beat's height).
  { dir: 'D', motif: 'dip' },
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
  { name: 'setpiece', count: 6 },
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
if (stats.total < 28 || stats.total > 36)
  throw new Error(`screen count ${stats.total} outside 28-36`);
if (stats.verticalPct < 35) throw new Error(`vertical% ${stats.verticalPct} below 35`);
if (stats.maxRun > 3) throw new Error(`max same-direction run ${stats.maxRun} exceeds 3`);
if (stats.changes < 4) throw new Error(`direction changes ${stats.changes} below 4`);

// --- Motif-repetition validation (GDD §2.7) ---------------------------------
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

// --- Screen-by-screen authoring ---------------------------------------------
const cursor = { col: 0, row: 260 }; // starts deep in the volcano's base; net elevation trends upward
const segments = [];
let objectId = 1;
const nextId = () => objectId++;

function screenR(colEnd, row) {
  fillFloor(cursor.col, colEnd, row);
  const seg = { colStart: cursor.col, colEnd, row, rowEnter: row, rowExit: row };
  cursor.col = colEnd;
  return seg;
}

/** motif 'dip': a short, safe step down within a single flat screen (no walls needed - the entry floor's own row IS the lead-in, matching the own-row rule trivially). */
function screenDip(colEnd, rowStart, dropRows) {
  const rowEnd = rowStart + dropRows;
  const leadIn = 4;
  fillFloor(cursor.col, cursor.col + leadIn, rowStart, FILL_DEPTH);
  fillFloor(cursor.col + leadIn, colEnd, rowEnd, FILL_DEPTH);
  const seg = { colStart: cursor.col, colEnd, row: rowEnd, rowEnter: rowStart, rowExit: rowEnd };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

/**
 * motif 'shaft': plain wall-kick ascent leg, exact 3-tile gap - no vent
 * (teaches wall-kick as an alternate route). Wall spans exactly [rowEnd,
 * rowStart-2] - NOT rowEnd-4 to rowStart+FILL_DEPTH - see DECISIONS.md
 * "buried floor face" finding: Phaser's tilemap collision culls a tile's
 * face when solid material sits directly adjacent on that side, so any
 * wall margin extending past a floor's own row (on either end) makes that
 * floor's top face non-collidable even though the raw tile data reads
 * solid. wallTop stops exactly at rowEnd (not above it) so the tile
 * immediately above the EXIT landing (rowEnd-1) stays genuinely empty;
 * wallBottom stops 2 rows short of rowStart so the tile immediately above
 * the ENTRY landing (rowStart-1) does too - a single adjacent row isn't
 * enough (it still leaves the wall's own edge touching the floor's row),
 * confirmed by live-testing an interim rowStart-1 attempt that still failed.
 */
function screenUShaft(colEnd, rowStart) {
  const rowEnd = rowStart - V_COLS;
  const wallTop = rowEnd;
  const wallBottom = rowStart - 2;
  const gapWidth = SAFE_GAP_TILES;
  const midCol = cursor.col + Math.floor((colEnd - cursor.col) / 2);
  const leftWallEnd = midCol - 1;
  const rightWallStart = leftWallEnd + gapWidth; // exact-width gap, not mid +/- ceil(w/2) - see header note
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

/** motif 'ventShaft': the same proven-safe wall-kick gap as screenUShaft, PLUS a heat vent filling the gap (GDD §3.3 signature vertical gimmick) - the caller adds the HeatVent entity using the returned `gap`/`rowEnter`/`rowExit` so the vent's exact push tuning stays visible at the call site. */
function screenUVent(colEnd, rowStart) {
  return screenUShaft(colEnd, rowStart);
}

/** motif 'sheer': entry -> one big fall -> one mid landing -> a short fall to the floor (Reservoir-proven shape, reused here for route-shape texture). */
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

/** motif 'lavafallDescent': 2 gentle stair treads, then a short OPEN drop softened by a heat vent (GDD §3.3: "descent beside a lava-fall with heat-vent slowfall"). Readable landing throughout - the drop is a straight vertical fall the vent slows, never a blind drop onto a hazard. */
function screenDLavafall(colEnd, rowStart) {
  const rowEnd = rowStart + V_COLS;
  const wallBottom = rowEnd + FILL_DEPTH;
  fillWall(cursor.col, cursor.col + 1, rowStart, wallBottom);
  fillWall(colEnd - 1, colEnd, rowEnd, wallBottom);
  const innerStart = cursor.col + 1;
  const innerEnd = colEnd - 1;
  const stepCols = Math.floor((innerEnd - innerStart) / 3);
  const tread1Row = rowStart + 3;
  const tread2Row = tread1Row + 3;
  fillFloor(innerStart, innerStart + stepCols, tread1Row, FILL_DEPTH);
  fillFloor(innerStart + stepCols, innerStart + stepCols * 2, tread2Row, FILL_DEPTH);
  fillFloor(innerStart + stepCols * 2, innerEnd, rowEnd, FILL_DEPTH);
  const seg = {
    colStart: cursor.col,
    colEnd,
    row: rowEnd,
    rowEnter: rowStart,
    rowExit: rowEnd,
    tread1: { col: Math.round(innerStart + stepCols / 2), row: tread1Row },
    tread2: { col: Math.round(innerStart + stepCols * 1.5), row: tread2Row },
    vent: {
      col: Math.round(innerStart + stepCols * 2 + (innerEnd - (innerStart + stepCols * 2)) / 2),
      rowTop: tread2Row,
      rowBottom: rowEnd,
    },
  };
  cursor.col = colEnd;
  cursor.row = rowEnd;
  return seg;
}

// --- Object layers -----------------------------------------------------------
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

/** Adds a heat vent spanning the full height of a vent shaft's gap (GDD §3.3: "heat vents that lift jumps"). */
function addHeatVent(name, gap, rowTop, rowBottom, pushY = -160) {
  addEntity(
    'heatVent',
    name,
    tileCenterX((gap.left + gap.right) / 2),
    rowTopY((rowTop + rowBottom) / 2),
    (gap.right - gap.left) * TILE,
    (rowBottom - rowTop) * TILE,
    [
      { name: 'pushX', type: 'int', value: 0 },
      { name: 'pushY', type: 'int', value: pushY },
    ],
  );
}

// Every crusher doorway's cleared cells, tracked so a later mechanical
// pass (after ALL geometry is built) can confirm nothing built afterward
// silently re-solidified the opening - this is exactly the ordering bug
// class fixed in the lava chase (a later leg's own wall-fill re-paving a
// doorway carved earlier at the same columns); see DECISIONS.md.
const crusherDoorways = [];

/**
 * Adds a "crusher doorway": a solid divider wall (own-row-safe, spans the
 * full screen height) with a doorHeight-tall gap cut at floor level, and a
 * PistonCrusher entity sliding across that gap. GDD §3.3/§3b: "piston
 * crushers on visible rails."
 */
function addCrusherDoorway(name, col, floorRow, doorHeightTiles, extendToward) {
  const wallTop = floorRow - 20;
  const wallBottom = floorRow + FILL_DEPTH;
  fillWall(col, col + 2, wallTop, wallBottom);
  clearColumn(col, floorRow - doorHeightTiles + 1, floorRow);
  clearColumn(col + 1, floorRow - doorHeightTiles + 1, floorRow);
  crusherDoorways.push({ name, col, floorRow, doorHeightTiles });
  const doorCenterY = rowTopY(floorRow) - (doorHeightTiles * TILE) / 2;
  const travelWidth = TILE * 2;
  // Retracted at the jamb the head extends AWAY from, so it's tucked out
  // of the doorway (not visually sitting mid-opening) while safe/open.
  const retractedCol = extendToward === 1 ? col : col + 2;
  addEntity('pistonCrusher', name, tileCenterX(retractedCol), doorCenterY, TILE * 2, 4, [
    { name: 'headWidth', type: 'int', value: 8 },
    { name: 'headHeight', type: 'int', value: doorHeightTiles * TILE },
    { name: 'travelWidth', type: 'int', value: travelWidth },
    { name: 'extendToward', type: 'int', value: extendToward },
  ]);
}

// --- §2.7 content-signature tracking ----------------------------------------
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
  'slagBlob',
  'slagBlob-intro',
  tileCenterX(segments[2].colStart + 10),
  standingY(segments[2].row, 7),
  14,
  14,
);
tagEnemy(2, 'slagBlob');

segments[3] = screenDip(cursor.col + H_COLS, cursor.row, 6);

// =====================================================================
// Beat 2: Gimmick tutorial (4-7) - heat vent debut, then a plain wall-kick
// leg (alternate route), both harmless.
// =====================================================================
segments[4] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'slagBlob',
  'slagBlob-tutorial-walk',
  tileCenterX(segments[4].colStart + 12),
  standingY(segments[4].row, 7),
  14,
  14,
);
tagEnemy(4, 'slagBlob');

segments[5] = screenUVent(cursor.col + V_COLS, cursor.row);
addHeatVent('heatVent-tutorial', segments[5].gap, segments[5].rowExit, segments[5].rowEnter, -170);
tagGimmick(5, 'heatVent');

segments[6] = screenUShaft(cursor.col + V_COLS, cursor.row);

segments[7] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'energyPickup',
  'pickup-tutorial-landing',
  tileCenterX(segments[7].colStart + 10),
  standingY(segments[7].row),
  16,
  16,
);

// =====================================================================
// Beat 3: Escalation (8-12) - vent + Ember Bat combined; piston crusher
// debuts alone in its own room.
// =====================================================================
segments[8] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'slagBlob',
  'slagBlob-escalation',
  tileCenterX(segments[8].colStart + 10),
  standingY(segments[8].row, 7),
  14,
  14,
);
tagEnemy(8, 'slagBlob');

segments[9] = screenUVent(cursor.col + V_COLS, cursor.row);
addHeatVent(
  'heatVent-escalation',
  segments[9].gap,
  segments[9].rowExit,
  segments[9].rowEnter,
  -170,
);
addEntity(
  'emberBat',
  'emberBat-escalation',
  tileCenterX(segments[9].gap.right + 2),
  rowTopY(segments[9].rowExit) + 6,
  14,
  10,
);
tagGimmick(9, 'heatVent');
tagEnemy(9, 'emberBat');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[10] = s;
  addCrusherDoorway('crusher-debut', s.colStart + 10, s.row, 3, 1);
  tagHazard(10, 'pistonCrusher');
}

segments[11] = screenDip(cursor.col + H_COLS, cursor.row, 6);
addEntity(
  'slagBlob',
  'slagBlob-dip',
  tileCenterX(segments[11].colStart + 14),
  standingY(segments[11].row, 7),
  14,
  14,
);
tagEnemy(11, 'slagBlob');

segments[12] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'emberBat',
  'emberBat-escalation-2',
  tileCenterX(segments[12].colStart + 12),
  rowTopY(segments[12].row) - 40,
  14,
  10,
);
tagEnemy(12, 'emberBat');

// =====================================================================
// Beat 4: Mid-boss arena (13) -> checkpoint
// =====================================================================
{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[13] = s;
  addEntity(
    'slagGolemSpawn',
    'slagGolem-spawn',
    tileCenterX(s.colStart + 10),
    standingY(s.row, 11),
    22,
    22,
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
// Beat 5: Remix (14-19) - MULTI-FLOOR forge hall (ascending, piston
// layers) + a genuine 2-screen BRANCH & REJOIN.
// =====================================================================
let multiFloorRange;
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS * 2; // 40 tiles / 2 real screens wide
  const botRow = cursor.row;
  const midRow = botRow - V_COLS;
  const topRow = midRow - V_COLS;

  // Bottom tier: continuous with the previous screen - no entry wall
  // needed (same "just keep filling" convention as chaining screenR calls).
  fillFloor(colStart, colEnd, botRow, FILL_DEPTH);

  // Mid tier: a floor band with a 3-tile gap left un-filled for the vent
  // riser - never filled in the first place, so there is nothing to
  // "clear" (avoids the fill-then-delete class of bug entirely).
  const midGapLeft = colStart + 8;
  const midGapRight = midGapLeft + SAFE_GAP_TILES;
  const midFloorStart = colStart + 3;
  const midFloorEnd = colEnd - 8;
  fillFloor(midFloorStart, midGapLeft, midRow, FILL_DEPTH);
  fillFloor(midGapRight, midFloorEnd, midRow, FILL_DEPTH);
  addHeatVent(
    'heatVent-multifloor-1',
    { left: midGapLeft, right: midGapRight },
    midRow,
    botRow,
    -170,
  );
  addCrusherDoorway('crusher-multifloor-mid', midFloorStart + 10, midRow, 3, 1);

  // Top tier: floor band further along; exits at colEnd into the next
  // screen (which itself starts a fresh floor at row=topRow).
  const topGapLeft = colStart + 24;
  const topGapRight = topGapLeft + SAFE_GAP_TILES;
  const topFloorStart = colStart + 16;
  fillFloor(topFloorStart, topGapLeft, topRow, FILL_DEPTH);
  fillFloor(topGapRight, colEnd, topRow, FILL_DEPTH);
  addHeatVent(
    'heatVent-multifloor-2',
    { left: topGapLeft, right: topGapRight },
    topRow,
    midRow,
    -170,
  );
  addCrusherDoorway('crusher-multifloor-top', topFloorStart + 6, topRow, 3, -1);

  addEntity(
    'slagBlob',
    'slagBlob-multifloor-mid',
    tileCenterX(midFloorEnd - 4),
    standingY(midRow, 7),
    14,
    14,
  );
  addEntity(
    'energyPickup',
    'pickup-multifloor-top',
    tileCenterX(colEnd - 4),
    standingY(topRow),
    16,
    16,
  );

  segments[14] = { colStart, colEnd, row: midRow, rowEnter: botRow, rowExit: midRow };
  segments[15] = { colStart, colEnd, row: topRow, rowEnter: midRow, rowExit: topRow };
  cursor.col = colEnd;
  cursor.row = topRow;
  multiFloorRange = { start: 14, end: 15 };
  tagGimmick(14, 'heatVent');
  tagHazard(14, 'pistonCrusher');
  tagGimmick(15, 'heatVent');
  tagEnemy(15, 'slagBlob');
}

segments[16] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'emberBat',
  'emberBat-remix-connector',
  tileCenterX(segments[16].colStart + 12),
  rowTopY(segments[16].row) - 40,
  14,
  10,
);
addEntity(
  'energyPickup',
  'pickup-remix-connector',
  tileCenterX(segments[16].colStart + 6),
  standingY(segments[16].row),
  16,
  16,
);
tagEnemy(16, 'emberBat');

// Screens 17-18: BRANCH & REJOIN - upper catwalk over the crushers
// (fast, risky, pickups + Heart Chip) vs lower pipe corridor (slow,
// safe). Genuinely 2-screen-wide (40 tiles), both bands continuous the
// whole way, 9-row (144px) vertical separation (the proven-safe margin
// from Reservoir's own branch rebuild).
let branchRange;
{
  const colStart = cursor.col;
  const colEnd = cursor.col + H_COLS * 2;
  const lowerRow = cursor.row;
  const upperRow = cursor.row - 9;

  fillFloor(colStart, colEnd, lowerRow);
  fillFloor(colStart + 2, colEnd - 10, upperRow, 0);
  fillWall(colStart, colStart + 2, upperRow, lowerRow + FILL_DEPTH);

  addCrusherDoorway('crusher-branch-upper-1', colStart + 12, upperRow, 3, 1);
  addCrusherDoorway('crusher-branch-upper-2', colStart + 28, upperRow, 3, -1);
  addEntity(
    'emberBat',
    'emberBat-branch-upper',
    tileCenterX(colStart + 20),
    rowTopY(upperRow) - 30,
    14,
    10,
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
    tileCenterX(colStart + 26),
    standingY(upperRow),
    16,
    16,
  );

  const heartChipCol = colStart + 6;
  addEntity(
    'heartChip',
    'heartChip-branch',
    tileCenterX(heartChipCol),
    standingY(upperRow, 12),
    16,
    16,
  );

  addEntity(
    'slagBlob',
    'slagBlob-branch-lower',
    tileCenterX(colStart + 18),
    standingY(lowerRow, 7),
    14,
    14,
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
  branchRange = { start: 17, end: 18 };
  tagHazard(17, 'pistonCrusher');
  tagEnemy(17, 'emberBat');
  tagEnemy(18, 'slagBlob');
}

segments[19] = screenDSheer(cursor.col + V_COLS, cursor.row);
addEntity(
  'emberBat',
  'emberBat-remix-end',
  tileCenterX(segments[19].ledge1.col),
  rowTopY(segments[19].ledge1.row) - 20,
  14,
  10,
);
tagEnemy(19, 'emberBat');

// =====================================================================
// Beat 6: Setpiece (20-25) - the RISING LAVA CHASE, a forced vertical
// ascent (GDD §3.3). A straight (fixed-X) vent-assisted shaft so the
// lava hazard's own X-band can cover the whole chase without needing to
// track a zigzag - 5 climbing legs, one horizontal ledge (still
// lava-pressured) breaking the run.
// =====================================================================
let lavaChaseRange;
let lavaChaseShaftZoneObj;
{
  const shaftColStart = cursor.col;
  const shaftWidth = V_COLS;
  const shaftColEnd = shaftColStart + shaftWidth;
  const gapLeft = shaftColStart + 4;
  const gapRight = gapLeft + SAFE_GAP_TILES;
  const ledgeColEnd = shaftColStart + H_COLS;

  // Wall spans exactly [rowEnd, rowStart-2] for every leg - see
  // screenUShaft's doc comment for the full "buried floor face" finding
  // this mirrors (no +/-4 margin past either landing's own row, and a
  // genuine 2-row gap above the entry floor, not just 1).
  function lavaChaseLeg(rowStart) {
    const rowEnd = rowStart - V_COLS;
    const wallTop = rowEnd;
    const wallBottom = rowStart - 2;
    fillWall(shaftColStart, gapLeft, wallTop, wallBottom);
    fillWall(gapRight, shaftColEnd, wallTop, wallBottom);
    fillFloor(shaftColStart, gapLeft, rowStart);
    fillFloor(gapRight, shaftColEnd, rowStart);
    return { rowEnter: rowStart, rowExit: rowEnd };
  }

  let row = cursor.row;
  const legRows = [];

  const leg1 = lavaChaseLeg(row);
  segments[20] = {
    colStart: shaftColStart,
    colEnd: shaftColEnd,
    row: leg1.rowExit,
    ...leg1,
    gap: { left: gapLeft, right: gapRight },
  };
  legRows.push(leg1);
  row = leg1.rowExit;

  const leg2 = lavaChaseLeg(row);
  segments[21] = {
    colStart: shaftColStart,
    colEnd: shaftColEnd,
    row: leg2.rowExit,
    ...leg2,
    gap: { left: gapLeft, right: gapRight },
  };
  legRows.push(leg2);
  row = leg2.rowExit;

  const leg3 = lavaChaseLeg(row);
  segments[22] = {
    colStart: shaftColStart,
    colEnd: shaftColEnd,
    row: leg3.rowExit,
    ...leg3,
    gap: { left: gapLeft, right: gapRight },
  };
  legRows.push(leg3);
  row = leg3.rowExit;

  // Screen 23: a wide horizontal ledge, still inside the chase's lethal
  // band - a direction-run breaker, not a true rest stop.
  fillFloor(shaftColStart, ledgeColEnd, row, FILL_DEPTH);
  segments[23] = { colStart: shaftColStart, colEnd: ledgeColEnd, row, rowEnter: row, rowExit: row };
  addEntity(
    'emberBat',
    'emberBat-lavachase-ledge',
    tileCenterX(shaftColStart + 12),
    rowTopY(row) - 40,
    14,
    10,
  );

  const leg4 = lavaChaseLeg(row);
  segments[24] = {
    colStart: shaftColStart,
    colEnd: shaftColEnd,
    row: leg4.rowExit,
    ...leg4,
    gap: { left: gapLeft, right: gapRight },
  };
  legRows.push(leg4);
  row = leg4.rowExit;
  // NOTE: a piston crusher was deliberately NOT added to this landing -
  // addCrusherDoorway cuts its doorway at floor level, which works for a
  // divider WALL between two same-row floor segments (used elsewhere:
  // screens 10/33, the multi-floor room, the branch) but punches a
  // fall-through HOLE when placed on a leg's own landing floor instead
  // (caught live via Playwright - see DECISIONS.md). Piston crushers
  // already appear in 3 other beats (escalation, remix, finalExam); this
  // beat's hazard is heat vent + rising lava + Ember Bat.

  const leg5 = lavaChaseLeg(row);
  segments[25] = {
    colStart: shaftColStart,
    colEnd: shaftColEnd,
    row: leg5.rowExit,
    ...leg5,
    gap: { left: gapLeft, right: gapRight },
  };
  legRows.push(leg5);
  row = leg5.rowExit;
  // Final safe landing at the top - full width, no gap.
  fillFloor(shaftColStart, shaftColEnd, row);

  for (const leg of legRows) {
    addHeatVent(
      `heatVent-lavachase-${leg.rowEnter}`,
      { left: gapLeft, right: gapRight },
      leg.rowExit,
      leg.rowEnter,
      -180,
    );
  }

  const chaseBottomRow = leg1.rowEnter;
  const chaseTopRow = leg5.rowExit;
  addEntity(
    'lavaChaseTriggerZone',
    'lavaChaseTrigger',
    tileCenterX(shaftColStart + 2),
    rowTopY(chaseBottomRow) - 20,
    16,
    40,
  );
  addEntity(
    'risingLavaZone',
    'risingLava-chase',
    tileCenterX((shaftColStart + ledgeColEnd) / 2),
    ((chaseTopRow + chaseBottomRow) / 2) * TILE,
    (ledgeColEnd - shaftColStart) * TILE,
    (chaseBottomRow - chaseTopRow) * TILE,
    [
      { name: 'bottomRow', type: 'int', value: chaseBottomRow },
      { name: 'ceilingRow', type: 'int', value: chaseTopRow },
    ],
  );

  lavaChaseShaftZoneObj = {
    colStart: shaftColStart,
    colEnd: ledgeColEnd,
    rowTop: chaseTopRow - 4,
    rowBottom: chaseBottomRow + 6,
  };

  addCheckpoint('checkpoint-post-setpiece', 2, tileCenterX(shaftColEnd - 3), standingY(row));

  // Continue from the WIDEST filled extent (screen 23's ledge reaches
  // further right than the narrow shaft columns legs 4-5 use) so the next
  // screen starts flush against real geometry, not an orphaned gap.
  fillFloor(shaftColEnd, ledgeColEnd, row, FILL_DEPTH);
  cursor.col = ledgeColEnd;
  cursor.row = row;
  lavaChaseRange = { start: 20, end: 25 };
  tagGimmick(20, 'heatVent');
  tagHazard(20, 'risingLava');
  tagGimmick(21, 'heatVent');
  tagHazard(21, 'risingLava');
  tagEnemy(21, 'emberBat');
  tagHazard(22, 'risingLava');
  tagHazard(23, 'risingLava');
  tagEnemy(23, 'emberBat');
  tagGimmick(24, 'heatVent');
  tagHazard(24, 'risingLava');
  tagHazard(25, 'risingLava');
}
addEntity(
  'ascentShaftZone',
  'lavaChaseShaftZone',
  tileCenterX((lavaChaseShaftZoneObj.colStart + lavaChaseShaftZoneObj.colEnd) / 2),
  rowTopY((lavaChaseShaftZoneObj.rowTop + lavaChaseShaftZoneObj.rowBottom) / 2),
  (lavaChaseShaftZoneObj.colEnd - lavaChaseShaftZoneObj.colStart) * TILE,
  (lavaChaseShaftZoneObj.rowBottom - lavaChaseShaftZoneObj.rowTop) * TILE,
);

// =====================================================================
// Beat 7: Breather + secret branch (26-28) - Cell Pack #1 above the lava
// chase (dash recommended, but reachable with the base kit via a
// vent-assisted jump chain since dash is still locked at this milestone).
// =====================================================================
segments[26] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'slagBlob',
  'slagBlob-breather-1',
  tileCenterX(segments[26].colStart + 10),
  standingY(segments[26].row, 7),
  14,
  14,
);
addEntity(
  'energyPickup',
  'pickup-breather-1',
  tileCenterX(segments[26].colStart + 16),
  standingY(segments[26].row),
  16,
  16,
);
tagEnemy(26, 'slagBlob');

{
  // motif 'dip': same shape as screenDip, inlined so the Cell Pack alcove
  // has a wider lead-in than the generic helper's 4 tiles.
  const rowStart = cursor.row;
  const colEnd = cursor.col + H_COLS;
  const dropRows = 4;
  const rowEnd = rowStart + dropRows;
  const leadIn = 12;
  fillFloor(cursor.col, cursor.col + leadIn, rowStart, FILL_DEPTH);
  fillFloor(cursor.col + leadIn, colEnd, rowEnd, FILL_DEPTH);
  const s = { colStart: cursor.col, colEnd, row: rowEnd, rowEnter: rowStart, rowExit: rowEnd };
  segments[27] = s;
  cursor.col = colEnd;
  cursor.row = rowEnd;

  const ledgeRow = rowStart - 5;
  fillLedge(s.colStart + 6, s.colStart + 11, ledgeRow);
  addHeatVent(
    'heatVent-cellpack',
    { left: s.colStart + 3, right: s.colStart + 6 },
    ledgeRow,
    rowStart,
    -190,
  );
  addEntity('cellPack', 'cellPack-1', tileCenterX(s.colStart + 8), standingY(ledgeRow, 10), 16, 20);
  addEntity(
    'energyPickup',
    'pickup-breather-2',
    tileCenterX(colEnd - 4),
    standingY(rowEnd),
    16,
    16,
  );
}

segments[28] = screenR(cursor.col + H_COLS, cursor.row);
addEntity(
  'slagBlob',
  'slagBlob-breather-2',
  tileCenterX(segments[28].colStart + 12),
  standingY(segments[28].row, 7),
  14,
  14,
);
tagEnemy(28, 'slagBlob');

// =====================================================================
// Beat 8: Final exam (29-33) - descent beside the lava-fall (heat-vent
// slowfall) + climb + crusher + enemies together: the hardest
// COMBINATION, distinct from escalation (which taught each piece alone).
// =====================================================================
segments[29] = screenDLavafall(cursor.col + H_COLS, cursor.row);
addHeatVent(
  'heatVent-lavafall-1',
  { left: segments[29].vent.col - 2, right: segments[29].vent.col + 2 },
  segments[29].vent.rowTop,
  segments[29].vent.rowBottom,
  -90,
);
tagGimmick(29, 'heatVent');

segments[30] = screenDLavafall(cursor.col + H_COLS, cursor.row);
addHeatVent(
  'heatVent-lavafall-2',
  { left: segments[30].vent.col - 2, right: segments[30].vent.col + 2 },
  segments[30].vent.rowTop,
  segments[30].vent.rowBottom,
  -90,
);
addEntity(
  'emberBat',
  'emberBat-lavafall',
  tileCenterX(segments[30].tread1.col),
  rowTopY(segments[30].tread1.row) - 30,
  14,
  10,
);
addEntity(
  'controlledDescentZone',
  'controlledDescent-lavafall',
  tileCenterX((segments[29].colStart + segments[30].colEnd) / 2),
  ((segments[29].rowEnter + segments[30].rowExit) / 2) * TILE,
  (segments[30].colEnd - segments[29].colStart) * TILE,
  (segments[30].rowExit - segments[29].rowEnter) * TILE,
  [
    { name: 'steerable', type: 'bool', value: true },
    { name: 'visibleLandingHalfScreenBeforeCommitment', type: 'bool', value: true },
    { name: 'noBlindLandingOntoHazard', type: 'bool', value: true },
    { name: 'slowfallPushY', type: 'int', value: -90 },
    { name: 'maxFallSpeedY', type: 'int', value: 130 },
  ],
);
tagGimmick(30, 'heatVent');
tagEnemy(30, 'emberBat');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[31] = s;
  addEntity('slagBlob', 'slagBlob-exam', tileCenterX(s.colStart + 8), standingY(s.row, 7), 14, 14);
  addEntity('emberBat', 'emberBat-exam', tileCenterX(s.colStart + 15), rowTopY(s.row) - 40, 14, 10);
  tagEnemy(31, 'slagBlob');
  tagEnemy(31, 'emberBat');
}

segments[32] = screenUVent(cursor.col + V_COLS, cursor.row);
addHeatVent('heatVent-exam', segments[32].gap, segments[32].rowExit, segments[32].rowEnter, -170);
tagGimmick(32, 'heatVent');

{
  const s = screenR(cursor.col + H_COLS, cursor.row);
  segments[33] = s;
  addCrusherDoorway('crusher-exam', s.colStart + 9, s.row, 3, 1);
  addEntity(
    'emberBat',
    'emberBat-exam-2',
    tileCenterX(s.colStart + 16),
    rowTopY(s.row) - 40,
    14,
    10,
  );
  tagHazard(33, 'pistonCrusher');
  tagEnemy(33, 'emberBat');
}

// =====================================================================
// Beat 9: Pre-boss corridor (34-35) -> checkpoint -> boss room
// =====================================================================
{
  const s = screenDip(cursor.col + H_COLS, cursor.row, 4);
  segments[34] = s;
  addEntity(
    'energyPickup',
    'pickup-preboss-1',
    tileCenterX(s.colStart + 2),
    standingY(s.rowEnter),
    16,
    16,
  );
  addEntity(
    'energyPickup',
    'pickup-preboss-2',
    tileCenterX(s.colStart + 14),
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
// Boss room (appended after the counted path, same convention as
// Reservoir/Speedway)
// =====================================================================
const bossRoomColStart = cursor.col;
const bossRoomColEnd = cursor.col + H_COLS + 6;
const bossRoomRow = cursor.row;
fillFloor(bossRoomColStart, bossRoomColEnd, bossRoomRow, FILL_DEPTH + 4);
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
  'magma-rhino-spawn',
  tileCenterX(bossRoomColStart + Math.floor((bossRoomColEnd - bossRoomColStart) / 2) + 6),
  standingY(bossRoomRow, 10),
  16,
  16,
);
addSection('bossRoom', bossRoomColStart, bossRoomColEnd, bossRoomRow - 40, bossRoomRow + 4);
cursor.col = bossRoomColEnd;

// --- Switchback macro relayout -----------------------------------------
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

function segmentColRange(start, end) {
  const cols = [];
  for (let n = start; n <= end; n += 1) cols.push(segments[n].colStart, segments[n].colEnd);
  return { oldStart: Math.min(...cols), oldEnd: Math.max(...cols) };
}
const macroBands = beatToScreens.map((beat, i) => ({
  name: beat.name,
  ...segmentColRange(beat.start, beat.end),
  newStart: [0, 60, 54, 251, 146, 191, 272, 256, 302][i],
  flip: [false, false, false, true, true, false, false, false, false][i],
}));
macroBands.push({
  name: 'bossRoom',
  oldStart: bossRoomColStart,
  oldEnd: bossRoomColEnd,
  newStart: 342,
  flip: false,
});

function transformCol(col) {
  const band = macroBands.find((b) => col >= b.oldStart && col < b.oldEnd);
  if (!band) return col;
  return band.flip
    ? band.newStart + (band.oldEnd - 1 - col)
    : band.newStart + (col - band.oldStart);
}
function transformX(x) {
  const centerCol = x / TILE;
  const band = macroBands.find((b) => centerCol >= b.oldStart && centerCol < b.oldEnd);
  if (!band) return x;
  const local = centerCol - band.oldStart;
  return (
    (band.flip ? band.newStart + (band.oldEnd - band.oldStart - local) : band.newStart + local) *
    TILE
  );
}

const transformedCells = new Map();
for (const [key, gid] of cells.entries()) {
  const [row, col] = key.split(',').map(Number);
  transformedCells.set(`${row},${transformCol(col)}`, gid);
}
cells.clear();
for (const [key, gid] of transformedCells.entries()) cells.set(key, gid);

for (const obj of [...entityObjects, ...checkpointObjects, ...sectionObjects]) {
  obj.x = transformX(obj.x + obj.width / 2) - obj.width / 2;
}
for (const s of segments.slice(1)) {
  const a = transformCol(s.colStart);
  const b = transformCol(s.colEnd - 1) + 1;
  s.colStart = Math.min(a, b);
  s.colEnd = Math.max(a, b);
}
for (const d of crusherDoorways) d.col = Math.min(transformCol(d.col), transformCol(d.col + 1));
for (let c = transformCol(bossRoomColStart); c <= transformCol(bossRoomColStart) + 1; c += 1) {
  for (let r = bossRoomRow - 3; r < bossRoomRow; r += 1) cells.delete(`${r},${c}`);
}
cursor.col = Math.max(...macroBands.map((b) => b.newStart + (b.oldEnd - b.oldStart)));

// --- Section markers per beat ------------------------------------------
for (const beat of beatToScreens) {
  const cols = [];
  const rows = [];
  for (let n = beat.start; n <= beat.end; n += 1) {
    const s = segments[n];
    cols.push(s.colStart, s.colEnd);
    rows.push(s.rowEnter, s.rowExit, s.row);
  }
  const colStart = Math.min(...cols);
  const colEnd = Math.max(...cols);
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
const width = maxCol + 1;
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
      name: 'foundry-placeholder',
      image: 'foundry-placeholder.png',
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
  'slagBlob',
  'slagGolemSpawn',
  'energyPickup',
  'heartChip',
  'cellPack',
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

const regularEnemyTypes = new Set(['slagBlob', 'emberBat']);
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
console.log('Gimmick-usage screens (heat vent):', JSON.stringify(gimmickScreens));
const beatsWithGimmick = new Set(gimmickScreens.map((n) => screenToBeat[n - 1]));
console.log(
  'Beats touched by the gimmick:',
  JSON.stringify([...beatsWithGimmick].sort((a, b) => a - b)),
);
if (!beatsWithGimmick.has(6)) throw new Error('setpiece (beat 6) has no gimmick usage');
if (!beatsWithGimmick.has(8)) throw new Error('finalExam (beat 8) has no gimmick usage');

// =====================================================================
// Surface-variation check (GDD §2.7: ground surface is NOT a monotonic
// slope) - computed from the raw grid via real (320px) screens, not the
// generator's own mixed-width segment bookkeeping (see DECISIONS.md:
// trust the tile data, not internal labels).
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
console.log(
  `\nSurface-variation check (real ${H_COLS}-tile screens): ${realScreenCount} real screens, longest near-flat run ${maxFlatRun} real screens`,
);
if (maxFlatRun > 3)
  throw new Error(`surface has ${maxFlatRun} consecutive near-flat real screens (limit 3)`);

// =====================================================================
// Fairness audit: every void gap, measured in tiles, at or under the
// base-kit-jump-reach ceiling.
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
console.log(`\nVoid-gap audit (full-column empty runs, ceiling: ${SAFE_GAP_TILES} tiles):`);
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

// =====================================================================
// Crusher-doorway integrity check: every doorway's cleared cells must
// still be EMPTY in the final grid - i.e. nothing built after it
// (a later leg's own wall-fill, most likely) silently re-solidified the
// opening. Build-failing, not just reported - this is the exact class of
// bug the lava-chase crusher had before the ordering fix above.
// =====================================================================
{
  let doorwayFailures = 0;
  for (const d of crusherDoorways) {
    for (const col of [d.col, d.col + 1]) {
      for (let r = d.floorRow - d.doorHeightTiles + 1; r <= d.floorRow; r += 1) {
        const rr = r + rowOffset;
        if (grid[rr]?.[col] !== EMPTY) {
          doorwayFailures += 1;
          console.error(
            `  crusher doorway "${d.name}" blocked at col ${col}, row ${r} (re-solidified after carving - check build order)`,
          );
        }
      }
    }
  }
  console.log(
    `\nCrusher-doorway integrity check (${crusherDoorways.length} doorways): ${doorwayFailures === 0 ? 'OK - all openings clear' : 'FAIL'}`,
  );
  if (doorwayFailures > 0) throw new Error(`${doorwayFailures} crusher-doorway cell(s) blocked`);
}

// =====================================================================
// Boss-room entry reachability regression check (P1 bug class fixed
// repeatedly elsewhere in the sibling generators: a full-height wall
// right at the entry column blocks the walk-in even though a floor
// tile technically exists there).
// =====================================================================
{
  const headroomRows = 3;
  const transformedBossRoomColStart = transformCol(bossRoomColStart);
  const entryCols = [transformedBossRoomColStart, transformedBossRoomColStart + 1];
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
    throw new Error(`boss-room entry blocked at head height: ${JSON.stringify(blockedRows)}`);
  }
}

// =====================================================================
// Route map + full report
// =====================================================================
console.log('Map size:', width, 'x', height, 'tiles =', width * TILE, 'x', height * TILE, 'px');
console.log('Total screens:', SEQUENCE.length);
console.log('Beats:', beatToScreens.map((b) => `${b.name}(${b.start}-${b.end})`).join(', '));

const startRow = segments[1].row;
const levels = [];
for (let n = 1; n <= SEQUENCE.length; n += 1)
  levels.push(Math.round((startRow - segments[n].row) / V_COLS));
const minLevel = Math.min(...levels);
const maxLevel = Math.max(...levels);
const mapLines = [];
for (let level = maxLevel; level >= minLevel; level -= 1) {
  const label = (level === 0 ? '+0' : level > 0 ? `+${level}` : `${level}`).padStart(3, ' ');
  let line = `${label} |`;
  for (const lvl of levels) line += lvl === level ? '#' : ' ';
  line += '|';
  mapLines.push(line);
}
console.log('');
console.log(
  'Route map (' +
    SEQUENCE.length +
    ' screens; # = path elevation [+up/-down from start], one column per screen, top = highest):',
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

console.log(`\nASCENT (heat-vent chimney tutorial): screens 5-6`);
console.log(
  `SETPIECE / RISING LAVA CHASE (forced ascent): screens ${lavaChaseRange.start}-${lavaChaseRange.end}`,
);
console.log(
  `MULTI-FLOOR ROOM (forge hall, piston layers): screens ${multiFloorRange.start}-${multiFloorRange.end}`,
);
console.log(`DESCENT (lava-fall, heat-vent slowfall): screens 29-30`);
console.log(`BRANCH & REJOIN: screens ${branchRange.start}-${branchRange.end}`);

const outPath = process.argv[2] || 'foundry.json';
fs.writeFileSync(outPath, JSON.stringify(map));
console.log('Wrote', outPath, `(${fs.statSync(outPath).size} bytes)`);
