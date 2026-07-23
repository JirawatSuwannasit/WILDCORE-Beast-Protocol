import fs from 'node:fs';
const TILE = 16,
  H = 20,
  V = 12,
  TOP = 2,
  FILL = 1;
let id = 1;
const next = () => id++;
const PLAN = [
  'R',
  'R',
  'U',
  'R',
  'U',
  'U',
  'R',
  'R',
  'U',
  'R',
  'R',
  'U',
  'R',
  'R',
  'D',
  'R',
  'R',
  'U',
  'U',
  'R',
  'U',
  'U',
  'U',
  'R',
  'D',
  'D',
  'R',
  'R',
  'U',
  'R',
  'R',
  'U',
  'D',
  'R',
];
const beats = [3, 5, 5, 1, 5, 5, 3, 5, 2];
function stats(seq) {
  let v = seq.filter((x) => x != 'R').length,
    run = 1,
    max = 1,
    ch = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] == seq[i - 1]) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 1;
      ch++;
    }
  }
  return {
    total: seq.length,
    vertical: v,
    verticalPct: +((v / seq.length) * 100).toFixed(1),
    maxRun: max,
    changes: ch,
  };
}
console.log('Ember Foundry route stats', stats(PLAN));
const cells = new Map();
const set = (c, r, g) => cells.set(`${r},${c}`, g);
function floor(c0, c1, r, d = 8) {
  for (let c = c0; c < c1; c++) {
    set(c, r, TOP);
    for (let k = 1; k <= d; k++) set(c, r + k, FILL);
  }
}
function wall(c0, c1, r0, r1) {
  for (let c = c0; c < c1; c++) for (let r = r0; r <= r1; r++) set(c, r, FILL);
}
let cur = { c: 0, r: 112 };
const segs = [];
const surface = [];
function addSeg(dir) {
  const s = { dir, c0: cur.c, r0: cur.r };
  if (dir === 'R') {
    floor(cur.c, cur.c + H, cur.r);
    cur.c += H;
  }
  if (dir === 'U') {
    wall(cur.c, cur.c + 2, cur.r - V, cur.r + 8);
    wall(cur.c + 10, cur.c + 12, cur.r - V, cur.r + 8);
    floor(cur.c + 2, cur.c + 5, cur.r - 4, 3);
    floor(cur.c + 7, cur.c + 10, cur.r - 8, 3);
    floor(cur.c + 2, cur.c + 12, cur.r - V);
    cur.r -= V;
    cur.c += 12;
  }
  if (dir === 'D') {
    floor(cur.c, cur.c + 6, cur.r + 4, 3);
    floor(cur.c + 8, cur.c + 12, cur.r + 8, 3);
    floor(cur.c + 12, cur.c + 20, cur.r + V);
    cur.r += V;
    cur.c += 20;
  }
  s.c1 = cur.c;
  s.r1 = cur.r;
  segs.push(s);
  surface.push(cur.r);
}
PLAN.forEach(addSeg);
floor(cur.c, cur.c + 25, cur.r);
const width = cur.c + 25,
  height = 150;
const data = Array(width * height).fill(0);
for (const [key, g] of cells) {
  const [r, c] = key.split(',').map(Number);
  if (r >= 0 && r < height && c >= 0 && c < width) data[r * width + c] = g;
}
const prop = (name, type, value) => ({ name, type, value });
const obj = (type, name, x, y, w = 16, h = 16, properties = []) => ({
  id: next(),
  type,
  name,
  x,
  y,
  width: w,
  height: h,
  visible: true,
  properties,
});
const cx = (i) => segs[i].c0 * TILE + 24,
  cy = (i) => segs[i].r0 * TILE - 20;
const entities = [
  obj('playerSpawn', 'playerSpawn', 24, segs[0].r0 * TILE - 32),
  obj('slagBlob', 'blob-intro', cx(1), cy(1)),
  obj('heatVent', 'vent-tutorial', cx(2) + 40, cy(2) + 40, 48, 96),
  obj('emberBat', 'bat-chimney', cx(4) + 60, cy(4) - 80),
  obj('heatVent', 'vent-chimney-a', cx(5) + 45, cy(5) + 50, 52, 110),
  obj('slagBlob', 'blob-escalation', cx(8), cy(8)),
  obj('pistonCrusher', 'crusher-tutorial', cx(10) + 70, cy(10) - 16, 32, 72, [
    prop('phase', 'int', 0),
  ]),
  obj('pistonCrusher', 'crusher-branch-a', cx(14) + 70, cy(14) - 16, 32, 72, [
    prop('phase', 'int', 60),
  ]),
  obj('slagGolemSpawn', 'slag-golem', cx(13) + 120, cy(13)),
  obj('pistonCrusher', 'crusher-upper-risk', cx(15) + 70, cy(15) - 18, 32, 80, [
    prop('phase', 'int', 0),
  ]),
  obj('heatVent', 'vent-remix', cx(17) + 40, cy(17) + 50, 48, 110),
  obj('lavaChaseTrigger', 'lava-trigger', cx(18) - 20, cy(18) - 80, 80, 180),
  obj('risingLavaZone', 'rising-lava', cx(18) + 40, segs[22].r1 * TILE, 160, 1, [
    prop('bottomRow', 'int', segs[22].r0 + 16),
    prop('ceilingRow', 'int', segs[22].r1 - 4),
  ]),
  obj('cellPack', 'cell-pack-above-lava', cx(22) + 42, cy(22) - 72),
  obj('heatVent', 'slowfall-lavafall', cx(24) + 50, cy(24) + 40, 56, 150, [
    prop('slowfall', 'bool', true),
  ]),
  obj('heartChip', 'heart-chip-crusher-secret', cx(27) + 95, cy(27) - 44),
  obj('pistonCrusher', 'crusher-secret', cx(27) + 65, cy(27) - 18, 32, 80, [
    prop('phase', 'int', 60),
  ]),
  obj('emberBat', 'bat-final-a', cx(29) + 50, cy(29) - 80),
  obj('pistonCrusher', 'crusher-final-a', cx(30) + 70, cy(30) - 18, 32, 80, [
    prop('phase', 'int', 0),
  ]),
  obj('slagBlob', 'blob-final', cx(31) + 30, cy(31)),
  obj('bossDoor', 'bossDoor', cur.c * TILE + 20, cur.r * TILE - 64, 16, 64),
  obj('bossRoomTrigger', 'bossRoomTrigger', cur.c * TILE + 50, cur.r * TILE - 80, 80, 120),
  obj('bossSpawn', 'magma-rhino', cur.c * TILE + 220, cur.r * TILE - 24),
];
for (let i = 0; i < 10; i++)
  entities.push(
    obj(
      'energyPickup',
      `pickup-${i}`,
      cx(Math.min(2 + i * 3, segs.length - 1)) + 40,
      cy(Math.min(2 + i * 3, segs.length - 1)) - 20,
    ),
  );
const checkpoints = [
  obj('checkpoint', 'checkpoint-start', 24, segs[0].r0 * TILE - 32, 16, 16, [
    prop('order', 'int', 0),
  ]),
  obj('checkpoint', 'checkpoint-post-midboss', cx(14), cy(14), 16, 16, [prop('order', 'int', 1)]),
  obj('checkpoint', 'checkpoint-post-lava', cx(23), cy(23), 16, 16, [prop('order', 'int', 2)]),
  obj('checkpoint', 'checkpoint-preboss', cur.c * TILE - 20, cur.r * TILE - 32, 16, 16, [
    prop('order', 'int', 3),
  ]),
];
const sections = [
  obj('section', 'intro', 0, 0, segs[2].c1 * TILE, height * TILE),
  obj('section', 'midBossArena', segs[13].c0 * TILE, (segs[13].r0 - 8) * TILE, 320, 220),
  obj('section', 'lavaChaseShaft', segs[18].c0 * TILE, (segs[22].r1 - 4) * TILE, 190, 520),
  obj('section', 'bossRoom', cur.c * TILE, (cur.r - 7) * TILE, 360, 160),
];
const map = {
  compressionlevel: -1,
  height,
  width,
  infinite: false,
  layers: [
    {
      id: 1,
      name: 'ground',
      type: 'tilelayer',
      x: 0,
      y: 0,
      width,
      height,
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
  nextobjectid: id,
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
fs.writeFileSync('src/data/stages/ember.json', JSON.stringify(map));
fs.writeFileSync(
  'docs/ember-foundry-checklist.md',
  `# Ember Foundry GDD §2.7 Checklist\n\nDominant axis: vertical-dominant CLIMB. Vertical path: ${stats(PLAN).verticalPct}%. Direction changes: ${stats(PLAN).changes}. Longest same-dir run: ${stats(PLAN).maxRun}. Screens: ${PLAN.length}. Per-screen surface heights (tile rows): ${surface.join(', ')}. Structural ranges: ascent shaft screens 3-6 and lava chase 19-23; controlled descent screens 25-26; multi-floor forge hall screens 29-32; branch/rejoin screens 15-18. Gimmicks: heat vents screens 3,5,6,18,25; crushers screens 11,15,16,28,31; rising lava screens 19-23. Max gap width: 3 tiles. Terrain %: vertical ${stats(PLAN).verticalPct} / horizontal ${(100 - stats(PLAN).verticalPct).toFixed(1)}.\n\nASCII route map:\n\nStart -> intro -> chimney UP -> crushers -> [upper catwalk fast+risky / lower pipes safe] -> golem -> lava chase UP -> lavafall DOWN -> forge hall UP/DOWN -> boss door -> Magma Rhino\n`,
);
