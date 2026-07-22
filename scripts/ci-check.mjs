import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['ci']],
  ['npm', ['run', 'verify:foundry']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'format:check']],
  ['node', ['scripts/generate-foundry-map.mjs', 'src/data/stages/foundry.json']],
  ['npm', ['run', 'format:check']],
  ['git', ['diff', '--exit-code', 'src/data/stages/foundry.json']],
  ['npm', ['run', 'test']],
  ['npm', ['run', 'build']],
];

for (const [cmd, args] of commands) {
  const commandText = [cmd, ...args].join(' ');
  console.log(`\n===== CI COMMAND: ${commandText} =====`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    console.error(`FAILED_COMMAND=${commandText}`);
    process.exit(exitCode);
  }
}

console.log('\nAll CI commands completed successfully.');
