import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['ci']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'format:check']],
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
