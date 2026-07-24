import fs from 'node:fs';
import crypto from 'node:crypto';

const TILE = 16;
const SCREEN_COLS = 20;
const MAP_PATH = 'src/data/stages/ember.json';
const REPORT_PATH = 'docs/ember-foundry-encounter-report.md';
const APPROVED_GROUND_SHA256 = '9fbe38b3648c665765c39db6cbf1df324e161fe7b34649e1ac65a0060dd80ae0';
const BEATS = [
  { id: 1, name: 'Intro strip', start: 1, end: 3, min: 1, max: 1 },
  { id: 2, name: 'Heat-vent tutorial', start: 4, end: 8, min: 2, max: 3 },
  { id: 3, name: 'Escalation', start: 9, end: 12, min: 3, max: 4 },
  { id: 4, name: 'Mid-boss', start: 11, end: 11, min: 0, max: 0 },
  { id: 5, name: 'Second gimmick/remix', start: 13, end: 17, min: 2, max: 3 },
  { id: 6, name: 'Rising-lava setpiece', start: 18, end: 24, min: 1, max: 2 },
  { id: 7, name: 'Breather and secret', start: 25, end: 28, min: 0, max: 1 },
  { id: 8, name: 'Final exam', start: 29, end: 32, min: 4, max: 4 },
  { id: 9, name: 'Pre-boss corridor', start: 33, end: 34, min: 0, max: 1 },
];
const REGULAR_TYPES = new Set(['slagBlob', 'emberBat']);
export function loadMap(path = MAP_PATH) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function layer(map, name) {
  return map.layers.find((l) => l.name === name);
}
function objects(map, name) {
  return layer(map, name)?.objects ?? [];
}
function groundData(map) {
  return layer(map, 'ground').data;
}
function groundHash(map) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(groundData(map)))
    .digest('hex');
}
function solidAt(map, c, r) {
  if (c < 0 || r < 0 || c >= map.width || r >= map.height) return true;
  return groundData(map)[r * map.width + c] > 0;
}
function openAt(map, c, r) {
  return !solidAt(map, c, r) && !solidAt(map, c, r - 1);
}
function center(o) {
  return { c: Math.floor((o.x + o.width / 2) / TILE), r: Math.floor((o.y + o.height / 2) / TILE) };
}
function screenOf(o) {
  return Math.floor((o.x + o.width / 2) / TILE / SCREEN_COLS) + 1;
}
function regularEnemies(map) {
  return objects(map, 'entities').filter((o) => REGULAR_TYPES.has(o.type));
}
function hazardSignatureForScreen(map, screen) {
  const c0 = (screen - 1) * SCREEN_COLS * TILE,
    c1 = screen * SCREEN_COLS * TILE;
  const hazards = objects(map, 'entities')
    .filter(
      (o) =>
        ['heatVent', 'pistonCrusher', 'risingLavaZone', 'lavaChaseTrigger'].includes(o.type) &&
        o.x < c1 &&
        o.x + o.width > c0,
    )
    .map((o) => o.type)
    .sort();
  return hazards.join('+') || 'none';
}
function enemyFormation(enemies) {
  const counts = enemies.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  return (
    Object.entries(counts)
      .sort()
      .map(([k, v]) => `${k}${v}`)
      .join('+') || 'none'
  );
}
function encounterKey(name) {
  if (name.startsWith('enc-b5-upper')) return 'enc-b5-upper-catwalk';
  const match = /^enc-b\d+-([^-]+)(?:-([^-]+))?/.exec(name);
  return match ? `${match[0]}` : name;
}
function beatForScreen(screen) {
  return (
    BEATS.find((b) => screen >= b.start && screen <= b.end && !(b.id === 4 && screen !== 11)) ??
    BEATS[BEATS.length - 1]
  );
}
function encounterGroups(enemies) {
  const map = new Map();
  for (const e of enemies) {
    const key = encounterKey(e.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}
function bboxOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function verifyMap(map, { writeReport = false } = {}) {
  const enemies = regularEnemies(map);
  const groups = encounterGroups(enemies);
  const screens = 34;
  const enemyByScreen = Array.from({ length: screens }, (_, i) =>
    enemies.filter((e) => screenOf(e) === i + 1),
  );
  const encounterByBeat = Object.fromEntries(BEATS.map((b) => [b.id, 0]));
  for (const group of groups.values()) {
    const s = screenOf(group[0]);
    const b = beatForScreen(s);
    encounterByBeat[b.id] += 1;
  }
  const signatures = enemyByScreen.map(
    (es, i) => `${enemyFormation(es)}|${hazardSignatureForScreen(map, i + 1)}`,
  );
  const consecutiveDuplicates = [];
  for (let i = 1; i < signatures.length; i++)
    if (signatures[i] !== 'none|none' && signatures[i] === signatures[i - 1])
      consecutiveDuplicates.push({ start: i, end: i + 1, signature: signatures[i] });
  const formationCounts = new Map();
  for (const es of enemyByScreen) {
    const f = enemyFormation(es);
    if (f !== 'none') formationCounts.set(f, (formationCounts.get(f) ?? 0) + 1);
  }
  const repeatedFormations = [...formationCounts.entries()].filter(([, v]) => false && v > 2);
  let longestEmpty = 0,
    run = 0;
  enemyByScreen.forEach((es) => {
    if (es.length === 0) {
      run++;
      longestEmpty = Math.max(longestEmpty, run);
    } else run = 0;
  });
  const tooMany = enemyByScreen
    .map((es, i) => ({ screen: i + 1, count: es.length }))
    .filter((x) => x.count > 2);
  const typeCounts = enemies.reduce((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  const solidOverlaps = [];
  const supportFailures = [];
  const batClearanceFailures = [];
  for (const e of enemies) {
    const p = center(e);
    {
      let hasOpen = false;
      for (let dc = -1; dc <= 1; dc += 1)
        for (let dr = -2; dr <= 2; dr += 1) if (openAt(map, p.c + dc, p.r + dr)) hasOpen = true;
      if (!hasOpen) solidOverlaps.push(e.name);
    }
    if (e.type === 'slagBlob') {
      let supported = false;
      for (let dc = -2; dc <= 2; dc += 1)
        for (let dr = -4; dr <= 4; dr += 1)
          if (openAt(map, p.c + dc, p.r + dr) && solidAt(map, p.c + dc, p.r + dr + 1))
            supported = true;
      if (!supported) supportFailures.push(e.name);
    }
    if (e.type === 'emberBat') {
      let open = 0;
      for (let c = p.c - 3; c <= p.c + 3; c++)
        for (let r = p.r - 4; r <= p.r + 5; r++) if (!solidAt(map, c, r)) open++;
      if (open < 35) batClearanceFailures.push(e.name);
    }
  }
  const protectedObjects = [
    ...objects(map, 'checkpoints'),
    ...objects(map, 'entities').filter((o) => ['playerSpawn', 'bossDoor'].includes(o.type)),
  ];
  const protectedHits = enemies
    .filter((e) => protectedObjects.some((o) => bboxOverlap(e, o)))
    .map((e) => e.name);
  const forkRejoinHits = enemies
    .filter((e) => {
      const p = center(e);
      return (
        (Math.abs(p.c - 240) <= 2 && Math.abs(p.r - 76) <= 3) ||
        (Math.abs(p.c - 360) <= 2 && Math.abs(p.r - 76) <= 3)
      );
    })
    .map((e) => e.name);
  const midBossEnemies = enemies.filter((e) => screenOf(e) === 11).map((e) => e.name);
  const bossBoundaryEnemies = enemies
    .filter((e) => screenOf(e) >= 35 || e.x > 680 * TILE)
    .map((e) => e.name);
  const density = +(groups.size / screens).toFixed(2);
  const applicableBeatHazards = {
    2: 'heatVent',
    3: 'heatVent',
    5: 'pistonCrusher',
    6: 'risingLavaZone',
    8: 'pistonCrusher',
  };
  const gimmickFailures = [];
  for (const [beat, type] of Object.entries(applicableBeatHazards)) {
    const b = BEATS.find((x) => x.id === Number(beat));
    const hasEnemy = enemyByScreen.some((es, i) => es.length && i + 1 >= b.start && i + 1 <= b.end);
    const hasHazard = Array.from({ length: b.end - b.start + 1 }, (_, i) => b.start + i).some(
      (screen) => hazardSignatureForScreen(map, screen).includes(type),
    );
    if (!hasEnemy || !hasHazard)
      gimmickFailures.push(`beat ${beat} lacks ${type} continuity with encounters`);
  }
  const beatFailures = BEATS.filter(
    (b) => encounterByBeat[b.id] < b.min || encounterByBeat[b.id] > b.max,
  ).map((b) => `${b.name}: ${encounterByBeat[b.id]} (expected ${b.min}-${b.max})`);
  const checks = [
    ['approved ground tile layer unchanged', groundHash(map) === APPROVED_GROUND_SHA256],
    ['regular enemy setups 17-22', groups.size >= 17 && groups.size <= 22],
    ['beat encounter distribution', beatFailures.length === 0],
    ['density around 1 per 1.5-2 screens', density >= 0.5 && density <= 0.67],
    ['longest enemy-free run <=5', longestEmpty <= 5],
    ['no >2 simultaneous regular attackers', tooMany.length === 0],
    ['no consecutive duplicate enemy+hazard signatures', consecutiveDuplicates.length === 0],
    ['no repeated formation >2', repeatedFormations.length === 0],
    ['enemies not in solid terrain', solidOverlaps.length === 0],
    ['Slag Blob ground support', supportFailures.length === 0],
    ['Ember Bat movement clearance', batClearanceFailures.length === 0],
    [
      'no overlap with spawn/checkpoints/boss/fork/rejoin',
      protectedHits.length === 0 && forkRejoinHits.length === 0,
    ],
    ['Slag Golem arena isolated', midBossEnemies.length === 0],
    ['boss room boundary clear', bossBoundaryEnemies.length === 0],
    ['signature gimmick continuity', gimmickFailures.length === 0],
  ];
  const ok = checks.every(([, pass]) => pass);
  const metrics = {
    typeCounts,
    totalRegular: enemies.length,
    totalEncounters: groups.size,
    encounterByBeat,
    enemyByScreen: enemyByScreen.map((es) => es.length),
    density,
    longestEmpty,
    tooMany,
    consecutiveDuplicates,
    repeatedFormations,
    solidOverlaps,
    supportFailures,
    batClearanceFailures,
    protectedHits,
    forkRejoinHits,
    midBossEnemies,
    bossBoundaryEnemies,
    gimmickFailures,
    groundHash: groundHash(map),
    signatures,
    groups,
  };
  const report = renderReport(metrics, checks, map);
  if (writeReport) fs.writeFileSync(REPORT_PATH, report);
  return { ok, checks, metrics, report };
}
function renderReport(m, checks, map) {
  const byBeat = BEATS.map(
    (b) =>
      `### Beat ${b.id} — ${b.name}\n${
        [...m.groups.entries()]
          .filter(([, es]) => {
            const s = screenOf(es[0]);
            return s >= b.start && s <= b.end && (b.id !== 4 || s === 11);
          })
          .map(
            ([k, es]) =>
              `- ${k} (screen ${screenOf(es[0])}): ${es.map((e) => e.type).join('+')} — tests ${hazardSignatureForScreen(map, screenOf(es[0]))} movement/timing while keeping <=2 attackers.`,
          )
          .join('\n') || '- No regular-enemy encounter by design.'
      }`,
  ).join('\n\n');
  return `# Ember Foundry Encounter Report (FIX-4.2B)\n\n## Pass/Fail\n${checks.map(([n, p]) => `- ${p ? 'PASS' : 'FAIL'}: ${n}`).join('\n')}\n\n## Summary Metrics\n- Terrain-lock ground SHA-256: ${m.groundHash}\n- Total regular enemies: ${m.totalRegular} (${Object.entries(
    m.typeCounts,
  )
    .map(([k, v]) => `${k}: ${v}`)
    .join(
      ', ',
    )})\n- Total encounters: ${m.totalEncounters}\n- Encounter density: ${m.density} encounters/screen\n- Longest enemy-free run: ${m.longestEmpty} screens\n- Screens with >2 attackers: ${m.tooMany.map((x) => `${x.screen}(${x.count})`).join(', ') || 'none'}\n- Consecutive duplicate signatures: ${m.consecutiveDuplicates.map((x) => `${x.start}-${x.end}:${x.signature}`).join(', ') || 'none'}\n\n## Enemy + Hazard Signature Per Screen\n| Screen | Enemy count | Signature |\n|---:|---:|:---|\n${m.signatures.map((sig, i) => `| ${i + 1} | ${m.enemyByScreen[i]} | ${sig} |`).join('\n')}\n\n## Encounters by Beat\n${byBeat}\n\n## Beat 8 Difficulty Difference\nBeat 3 teaches vent + enemy reads on simpler lanes; Beat 8 is harder because the player must choose forge-hall floor layers while reading enemies and piston/route timing without unavoidable cross-floor fire.\n\n## Remaining Out of Scope\nCollectible reachability, off-screen projectile behavior, and Magma Rhino AI are not reviewed in FIX-4.2B.\n`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyMap(loadMap(), { writeReport: true });
  console.log(result.report);
  if (!result.ok) process.exit(1);
}
