import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const TILE = 16;
const SCREEN_COLS = 20;
const SCREENS = 34;
const WIDTH = 730;
const HEIGHT = 150;
const EMPTY = 0;
const FILL = 1;
const TOP = 2;
let objectId = 1;
const nextId = () => objectId++;
const cells = new Map();
const key = (c, r) => `${r},${c}`;
const setTile = (c, r, gid) => {
  if (c >= 0 && c < WIDTH && r >= 0 && r < HEIGHT) cells.set(key(c, r), gid);
};
const isSolid = (c, r) => cells.has(key(c, r));
function floor(c0, c1, r, d = 8) {
  for (let c = c0; c < c1; c++) {
    setTile(c, r, TOP);
    for (let k = 1; k <= d; k++) setTile(c, r + k, FILL);
  }
}
function wall(c0, c1, r0, r1) {
  for (let c = c0; c < c1; c++) for (let r = r0; r <= r1; r++) setTile(c, r, FILL);
}
function ledge(c0, c1, r) {
  floor(c0, c1, r, 3);
}
function rail(c0, c1, r) {
  floor(c0, c1, r, 2);
}
function obj(type, name, x, y, width = 16, height = 16, properties = []) {
  return { id: nextId(), type, name, x, y, width, height, visible: true, properties };
}
const prop = (name, type, value) => ({ name, type, value });

// 34 measured traversal screens. Direction changes and vertical% are verified from row deltas.
const surfaceRows = [
  112, 112, 104, 96, 88, 80, 80, 76, 72, 76, 76, 76, 76, 72, 68, 72, 76, 76, 64, 52, 40, 28, 16, 16,
  28, 40, 40, 40, 32, 32, 32, 24, 28, 28,
];
const motifs = [
  'village',
  'village',
  'chimney',
  'chimney',
  'chimney',
  'chimney',
  'rail',
  'rail',
  'rail',
  'rail',
  'midboss',
  'fork',
  'upperCatwalk',
  'upperCatwalk',
  'branchMix',
  'lowerPipe',
  'rejoin',
  'remix',
  'lavaShaft',
  'lavaShaft',
  'lavaShaft',
  'lavaShaft',
  'lavaShaft',
  'lavaTop',
  'lavafall',
  'lavafall',
  'breather',
  'secret',
  'forgeHall',
  'forgeHall',
  'forgeHall',
  'forgeHall',
  'preboss',
  'preboss',
];

function buildVillage(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  floor(x, x + 18, r);
  ledge(x + 8, x + 13, r - 4);
}
function buildChimney(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  wall(x, x + 2, r - 14, r + 8);
  wall(x + 17, x + 19, r - 14, r + 8);
  ledge(x + 3, x + 8, r);
  ledge(x + 12, x + 17, r - 4);
  ledge(x + 5, x + 11, r - 8);
  ledge(x + 13, x + 18, r - 12);
}
function buildRail(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  floor(x, x + 20, r);
  rail(x + 2, x + 7, r - 6);
  rail(x + 11, x + 17, r - 10);
  wall(x + 9, x + 10, r - 11, r - 3);
}
function buildMidboss(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  floor(x, x + 20, r);
  wall(x, x + 1, r - 9, r + 8);
  wall(x + 19, x + 20, r - 9, r + 8);
}
function buildBranch(s) {
  const x = s * SCREEN_COLS; // actual two independent tile paths between fork and rejoin
  // Upper fast/risky catwalks: narrow, elevated, staggered.
  ledge(x, x + 5, 76);
  ledge(x + 5, x + 10, 72);
  ledge(x + 10, x + 14, 68);
  ledge(x + 14, x + 20, 72);
  // Lower pipe route: wider, slower, extra movement step down and up.
  floor(x, x + 6, 84);
  floor(x + 6, x + 11, 88);
  floor(x + 11, x + 16, 84);
  floor(x + 16, x + 20, 80);
  wall(x + 2, x + 3, 85, 92);
  wall(x + 17, x + 18, 81, 88);
}
function buildRejoin(s) {
  const x = s * SCREEN_COLS;
  floor(x, x + 20, 76);
  ledge(x + 4, x + 10, 68);
  ledge(x + 12, x + 18, 84);
}
function buildLavaShaft(s, i) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  wall(x, x + 2, r - 8, r + 16);
  wall(x + 18, x + 20, r - 8, r + 16);
  ledge(x + 2, x + 18, r);
  if (i % 2 === 0) {
    ledge(x + 3, x + 8, r - 3);
    ledge(x + 12, x + 17, r - 7);
    ledge(x + 6, x + 11, r - 14);
  } else {
    ledge(x + 12, x + 17, r - 3);
    ledge(x + 4, x + 9, r - 6);
    ledge(x + 10, x + 16, r - 12);
  }
}
function buildLavafall(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  ledge(x, x + 7, r);
  ledge(x + 9, x + 15, r + 5);
  ledge(x + 3, x + 9, r + 10);
  ledge(x + 13, x + 20, r + 15);
  wall(x + 19, x + 20, r - 5, r + 18);
}
function buildForgeHall(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  floor(x, x + 20, r + 10);
  ledge(x, x + 8, r);
  ledge(x + 11, x + 20, r);
  ledge(x + 2, x + 10, r - 8);
  ledge(x + 12, x + 18, r - 8);
  ledge(x + 5, x + 15, r - 16);
  wall(x + 9, x + 10, r - 15, r + 9);
}
function buildPreboss(s) {
  const x = s * SCREEN_COLS,
    r = surfaceRows[s];
  floor(x, x + 20, r);
  ledge(x + 6, x + 11, r - 5);
}
for (let s = 0; s < SCREENS; s++) {
  const m = motifs[s];
  if (m === 'village') buildVillage(s);
  else if (m === 'chimney') buildChimney(s);
  else if (m === 'rail' || m === 'remix') buildRail(s);
  else if (m === 'midboss') buildMidboss(s);
  else if (['fork', 'upperCatwalk', 'branchMix', 'lowerPipe'].includes(m)) buildBranch(s);
  else if (m === 'rejoin') buildRejoin(s);
  else if (m === 'lavaShaft' || m === 'lavaTop') buildLavaShaft(s, s - 18);
  else if (m === 'lavafall' || m === 'breather' || m === 'secret') buildLavafall(s);
  else if (m === 'forgeHall') buildForgeHall(s);
  else buildPreboss(s);
}
floor(SCREENS * SCREEN_COLS, SCREENS * SCREEN_COLS + 18, surfaceRows[SCREENS - 1]);
// Solid outer boundaries / intentional dead ends.
wall(0, 1, 0, HEIGHT - 1);
wall(WIDTH - 1, WIDTH, 0, HEIGHT - 1);
wall(0, WIDTH, HEIGHT - 1, HEIGHT - 1);

const data = Array(WIDTH * HEIGHT).fill(EMPTY);
for (const [k, g] of cells) {
  const [r, c] = k.split(',').map(Number);
  data[r * WIDTH + c] = g;
}
const px = (col) => col * TILE;
const py = (row) => row * TILE;

const blob = (name, col, floorRow) => obj('slagBlob', name, px(col), py(floorRow - 2));
const bat = (name, col, row) => obj('emberBat', name, px(col), py(row));
const encounterPlacements = [
  // Beat 1: intro strip, single easy read.
  blob('enc-b1-blob-intro', 21, 112),
  // Beat 2: heat-vent tutorial after the first safe vent read.
  bat('enc-b2-bat-vent-perch', 86, 78),
  blob('enc-b2-blob-rail-approach', 128, 82),
  bat('enc-b2-bat-high-ledge', 151, 66),
  // Beat 3: escalation, including one blob+bat combination.
  blob('enc-b3-blob-vent-combo', 169, 74),
  bat('enc-b3-bat-vent-combo', 174, 61),
  blob('enc-b3-blob-crusher-read', 190, 78),
  bat('enc-b3-bat-safe-landing-check', 235, 66),
  // Beat 5: branch/remix, different upper/lower signatures.
  blob('enc-b5-upper-blob-crusher', 258, 73),
  bat('enc-b5-upper-bat-catwalk', 270, 61),
  blob('enc-b5-lower-blob-pipe', 306, 86),
  bat('enc-b5-rejoin-bat', 338, 68),
  // Beat 6: light upward movement pressure only.
  bat('enc-b6-bat-lava-updraft-a', 384, 45),
  bat('enc-b6-bat-lava-updraft-b', 438, 14),
  // Beat 7: optional calm-side encounter.
  blob('enc-b7-optional-secret-blob', 546, 43),
  // Beat 8: four final-exam encounters, max two attackers per screen.
  blob('enc-b8-blob-floor-choice-a', 568, 42),
  bat('enc-b8-bat-layer-choice-a', 579, 20),
  blob('enc-b8-blob-piston-layer-b', 590, 43),
  bat('enc-b8-bat-piston-layer-c', 617, 18),
  // Beat 9: one simple pre-boss guard, kept away from boss boundary.
  blob('enc-b9-simple-preboss-blob', 660, 30),
];
const entities = [
  obj('playerSpawn', 'playerSpawn', px(2), py(110)),
  ...encounterPlacements,
  obj('heatVent', 'vent-chimney-a', px(62), py(94), 48, 160),
  obj('ascentShaftZone', 'forge-chimney-camera', px(70), py(88), 260, 520),
  obj('heatVent', 'vent-escalation-continuity', px(172), py(72), 48, 128),
  obj('pistonCrusher', 'crusher-rail-a', px(150), py(66), 32, 80, [prop('phase', 'int', 0)]),
  obj('pistonCrusher', 'crusher-upper-risk', px(258), py(62), 32, 84, [prop('phase', 'int', 60)]),
  obj('slagGolemSpawn', 'slag-golem', px(210), py(74)),
  obj('lavaChaseTrigger', 'lava-trigger', px(366), py(58), 96, 520),
  obj('risingLavaZone', 'rising-lava', px(400), py(94), 180, 1, [
    prop('bottomRow', 'int', 96),
    prop('ceilingRow', 'int', 4),
  ]),
  obj('heatVent', 'slowfall-lavafall', px(505), py(36), 64, 360, [prop('slowfall', 'bool', true)]),
  obj('pistonCrusher', 'crusher-final-exam-continuity', px(602), py(28), 32, 84, [
    prop('phase', 'int', 30),
  ]),
  obj('heartChip', 'heart-chip-crusher-secret', px(548), py(30)),
  obj('cellPack', 'cell-pack-above-lava', px(455), py(10)),
  obj('bossDoor', 'bossDoor', px(684), py(20), 16, 64),
  obj('bossRoomTrigger', 'bossRoomTrigger', px(688), py(18), 96, 128),
  obj('bossSpawn', 'magma-rhino', px(704), py(26)),
];
for (let i = 0; i < 10; i++)
  entities.push(
    obj(
      'energyPickup',
      `pickup-${i}`,
      px(25 + i * 55),
      py(Math.max(8, surfaceRows[Math.min(33, 2 + i * 3)] - 3)),
    ),
  );
const checkpoints = [
  obj('checkpoint', 'checkpoint-start', px(2), py(110), 16, 16, [prop('order', 'int', 0)]),
  obj('checkpoint', 'checkpoint-post-midboss', px(225), py(70), 16, 16, [prop('order', 'int', 1)]),
  obj('checkpoint', 'checkpoint-post-lava', px(470), py(14), 16, 16, [prop('order', 'int', 2)]),
  obj('checkpoint', 'checkpoint-preboss', px(640), py(26), 16, 16, [prop('order', 'int', 3)]),
];
const sections = [
  obj('section', 'forgeChimney', px(40), py(72), 320, 600),
  obj('section', 'branch', px(240), py(58), 1400, 560),
  obj('section', 'lavaChaseShaft', px(360), py(0), 220, 1100),
  obj('section', 'forgeHall', px(560), py(0), 320, 760),
  obj('section', 'bossRoom', px(680), py(0), 360, 160),
];
const map = {
  compressionlevel: -1,
  height: HEIGHT,
  width: WIDTH,
  infinite: false,
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width: WIDTH,
      height: HEIGHT,
      data,
      opacity: 1,
      visible: true,
    },
    {
      id: 2,
      name: 'checkpoints',
      type: 'objectgroup',
      objects: checkpoints,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    },
    {
      id: 3,
      name: 'hazards',
      type: 'objectgroup',
      objects: [],
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    },
    {
      id: 4,
      name: 'entities',
      type: 'objectgroup',
      objects: entities,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    },
    {
      id: 5,
      name: 'sections',
      type: 'objectgroup',
      objects: sections,
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    },
  ],
  nextlayerid: 6,
  nextobjectid: objectId,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: TILE,
  tilewidth: TILE,
  tilesets: [
    {
      firstgid: 1,
      name: 'ember-placeholder',
      image: 'ember-placeholder.png',
      imagewidth: 32,
      imageheight: 16,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: 2,
      columns: 2,
      margin: 0,
      spacing: 0,
    },
  ],
  type: 'map',
  version: '1.10',
};
fs.writeFileSync('src/data/stages/ember.json', `${JSON.stringify(map, null, 2)}\n`);
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prettier', '--write', 'src/data/stages/ember.json'],
  { stdio: 'inherit' },
);
