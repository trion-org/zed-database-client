import process from 'node:process';
import { spawnSync } from 'node:child_process';

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail(
        'Required command "gitleaks" was not found. Install gitleaks or set GITLEAKS_BIN to its absolute path.'
      );
    }

    throw result.error;
  }

  process.exit(result.status ?? 1);
}

const mode = process.argv[2] ?? 'history';
const gitleaksExecutable = process.env.GITLEAKS_BIN || 'gitleaks';

if (mode === 'staged') {
  run(gitleaksExecutable, ['git', '--staged', '--redact', '--no-banner']);
}

if (mode === 'history') {
  run(gitleaksExecutable, ['git', '.', '--redact', '--no-banner']);
}

fail('Usage: node ./scripts/run-gitleaks.mjs <history|staged>');
