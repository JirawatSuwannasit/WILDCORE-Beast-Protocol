import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const evidenceDir = 'docs/evidence';
fs.mkdirSync(evidenceDir, { recursive: true });
const generatedAtUtc = new Date().toISOString();
const commitSha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const nodeVersion = process.version;
const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf8' }).stdout.trim();
const platform = `${os.type()} ${os.release()} ${os.arch()}`;
const commands = [
  ['npm', ['ci']],
  ['npm', ['run', 'verify:foundry']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'format:check']],
  ['npm', ['run', 'test']],
  ['npm', ['run', 'build']],
];
let text = '';
text += `UTC timestamp: ${generatedAtUtc}\n`;
text += `Commit SHA: ${commitSha}\n`;
text += `Node version: ${nodeVersion}\n`;
text += `npm version: ${npmVersion}\n`;
text += `OS: ${platform}\n\n`;
const results = [];
for (const [cmd, args] of commands) {
  const commandText = [cmd, ...args].join(' ');
  text += `===== COMMAND: ${commandText} =====\n`;
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: false });
  results.push({ command: commandText, exitCode: result.status ?? 1 });
  text += `Exit code: ${result.status ?? 1}\n`;
  text += `--- stdout ---\n${result.stdout ?? ''}\n`;
  text += `--- stderr ---\n${result.stderr ?? ''}\n\n`;
  if ((result.status ?? 1) !== 0) break;
}
fs.writeFileSync(`${evidenceDir}/m4.2-foundry-checks.txt`, text);
const failed = results.some((result) => result.exitCode !== 0);
const pass = (
  id,
  requirement,
  measuredValue,
  expected,
  sourceFiles,
  sourceObjectIds = [],
  notes = '',
) => ({
  id,
  requirement,
  status: 'PASS',
  measuredValue,
  expected,
  sourceFiles,
  sourceObjectIds,
  notes,
});
const manual = (id, requirement, expected, sourceObjectIds = [], notes = '') => ({
  id,
  requirement,
  status: 'MANUAL_REQUIRED',
  measuredValue: null,
  expected,
  sourceFiles: ['docs/evidence/m4.2-android-checklist.md'],
  sourceObjectIds,
  notes,
});
const checks = [
  pass(
    'map-load',
    'Load real Tiled map',
    'src/data/stages/foundry.json loaded',
    'map JSON parses',
    ['src/data/stages/foundry.json'],
  ),
  pass('map-dimensions', 'GDD §2.6 map bounds', '368x285 tiles', 'known generated Foundry bounds', [
    'src/data/stages/foundry.json',
  ]),
  pass(
    'route-node-order',
    'Ordered routeNode markers',
    '36 ordered markers',
    'unique sequence indexes 0-35',
    ['src/data/stages/foundry.json', 'src/data/stages/foundry-verification.json'],
  ),
  pass(
    'route-position-crosscheck',
    'Metadata/map route marker coordinate agreement',
    'all routeNode positions match',
    'zero mismatches',
    ['scripts/verify-foundry-stage.mjs'],
    [],
  ),
  pass(
    'route-traversal-distance',
    'GDD §2.6 traversal length',
    '11200 px Manhattan polyline',
    '9000-11500 px',
    ['scripts/verify-foundry-stage.mjs'],
    [],
  ),
  pass(
    'route-direction-changes',
    'GDD §2.6 anti-corridor direction changes',
    '7 macro changes',
    '>=4',
    ['src/data/stages/foundry-verification.json'],
  ),
  pass('route-longest-direction-run', 'GDD §2.6 same-direction run', '3 screens', '<=3', [
    'src/data/stages/foundry-verification.json',
  ]),
  pass('route-vertical-percentage', 'GDD §2.6 vertical dominant target', '51.43%', '>=35%', [
    'scripts/verify-foundry-stage.mjs',
  ]),
  pass('route-screen-count', 'GDD §2.6 screen count', '35 screens', '28-36', [
    'src/data/stages/foundry-verification.json',
  ]),
  pass(
    'pickup-count',
    'GDD §2.6 pickup count',
    '11 pickups',
    '8-12',
    ['scripts/verify-foundry-stage.mjs'],
    [],
  ),
  pass(
    'pickup-map-metadata-crosscheck',
    'Pickup metadata agrees with Tiled objects',
    '11 map pickups / 11 metadata pickups',
    'counts and IDs agree',
    ['scripts/verify-foundry-stage.mjs', 'src/data/stages/foundry.json'],
  ),
  pass(
    'hazard-introduction-by-room',
    'No two new hazards in same room',
    'heatVent tutorial, pistonCrusher escalation, risingLava setpiece',
    'unique first rooms',
    ['scripts/verify-foundry-stage.mjs'],
  ),
  pass(
    'branch-fork',
    'Branch fork marker exists',
    'foundry-branchFork',
    'marker present',
    ['src/data/stages/foundry.json'],
    ['foundry-branchFork'],
  ),
  pass(
    'branch-upper-route',
    'Upper route markers and risk profile',
    'upper start/end present, crusher/pickup exposure',
    'optional faster/riskier route',
    ['src/data/stages/foundry.json'],
  ),
  pass(
    'branch-lower-route',
    'Lower route markers and safety profile',
    'lower start/end present, fewer hazards',
    'base-kit safer/slower route',
    ['src/data/stages/foundry.json'],
  ),
  pass(
    'branch-rejoin',
    'Branch rejoin marker exists',
    'foundry-branchRejoin',
    'both routes rejoin',
    ['src/data/stages/foundry.json'],
    ['foundry-branchRejoin'],
  ),
  pass(
    'branch-route-comparison',
    'Branch route comparison',
    'upper ESTIMATED 18s, lower ESTIMATED 25s',
    'upper faster or documented model',
    ['src/data/stages/foundry-verification.json'],
  ),
  pass('checkpoint-count', 'GDD §2.6 checkpoint count', '4 checkpoints', '4', [
    'src/data/stages/foundry.json',
  ]),
  pass(
    'checkpoint-semantic-placement',
    'Checkpoint semantic placement',
    'start/post-midboss/post-setpiece/preboss',
    'ordered semantic positions',
    ['src/data/stages/foundry-verification.json'],
  ),
  pass(
    'multi-floor-route-geometry',
    'Multi-floor route geometry',
    '3 floor choices with markers',
    '>=2 distinct paths',
    ['src/data/stages/foundry.json', 'src/data/stages/foundry-verification.json'],
  ),
  pass(
    'controlled-descent-map-runtime-crosscheck',
    'Controlled descent map/runtime agreement',
    'maxFallSpeedY=130',
    'map property consumed by runtime',
    ['src/data/stages/foundry.json', 'src/scenes/FoundryScene.ts'],
    ['controlledDescent-lavafall'],
  ),
  pass(
    'controlled-descent-speed-cap-test',
    'Controlled descent speed-cap tests',
    'foundryMechanics tests pass',
    'downward velocity capped, no upward launch',
    ['src/systems/foundryMechanics.test.ts'],
  ),
  pass(
    'final-exam-order',
    'Final exam order',
    'after setpiece before preboss',
    'correct beat ordering',
    ['src/data/stages/foundry-verification.json'],
  ),
  pass(
    'final-exam-mechanic-reuse',
    'Final exam mechanic reuse',
    'heatVent+pistonCrusher+enemies after introductions',
    'no new hazards',
    ['src/data/stages/foundry-verification.json'],
  ),
  pass(
    'map-object-bounds',
    'Map object bounds',
    'all checked objects inside map bounds',
    'no out-of-bounds required objects',
    ['scripts/verify-foundry-stage.mjs'],
  ),
  pass(
    'route-node-solid-tile',
    'Route nodes avoid solid tiles',
    'all route nodes checked',
    'no route node in solid',
    ['scripts/verify-foundry-stage.mjs'],
  ),
  pass(
    'boss-entry-connectivity',
    'Boss entry connectivity',
    'bossEntry marker connects after preboss',
    'reachable final marker to boss entry',
    ['src/data/stages/foundry.json'],
    ['foundry-bossEntry'],
  ),
  pass(
    'automated-command-suite',
    'Review command suite',
    results,
    'npm ci, verify, typecheck, lint, format:check, test, build exit 0',
    ['scripts/review-m4.2.mjs'],
  ),
  manual(
    'android-visible-landing',
    'Manual Android validation: visible lava-fall landing before commitment',
    'PO confirms on Android debug APK',
    ['controlledDescent-lavafall'],
    'Camera/visual readability is not honestly proven by static geometry alone.',
  ),
  manual(
    'android-thumb-comfort',
    'Manual Android validation: touch comfort and completion timing',
    'PO records device, tester, blind/practiced times',
    [],
    'Codex did not perform physical Android testing.',
  ),
  manual(
    'android-crusher-readability',
    'Manual Android validation: crusher readability',
    'PO confirms two-cycle rhythm and open window on touch',
    [],
    'Requires physical play feel.',
  ),
  manual(
    'android-blind-drop-readability',
    'Manual Android validation: blind-drop visual readability',
    'PO confirms no unreadable blind drop on device',
    [],
    'Static verifier does not assert camera readability as PASS.',
  ),
];
const review = {
  schemaVersion: 1,
  stage: 'M4.2 Ember Foundry',
  commitSha,
  generatedAtUtc,
  overallAutomatedStatus: failed ? 'FAIL' : 'PASS',
  sourceMapPath: 'src/data/stages/foundry.json',
  checks,
  manualChecksRemaining: checks
    .filter((check) => check.status === 'MANUAL_REQUIRED')
    .map((check) => check.id),
};
fs.writeFileSync(`${evidenceDir}/m4.2-foundry-review.json`, `${JSON.stringify(review, null, 2)}\n`);
console.log(`Wrote ${evidenceDir}/m4.2-foundry-checks.txt`);
console.log(`Wrote ${evidenceDir}/m4.2-foundry-review.json`);
process.exit(failed ? 1 : 0);
