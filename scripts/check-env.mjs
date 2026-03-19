import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cargoHomeBin = path.join(os.homedir(), '.cargo', 'bin');
const pathDelimiter = path.delimiter;
const cargoExecutable = fs.existsSync(path.join(cargoHomeBin, 'cargo'))
  ? path.join(cargoHomeBin, 'cargo')
  : 'cargo';
const rustupExecutable = fs.existsSync(path.join(cargoHomeBin, 'rustup'))
  ? path.join(cargoHomeBin, 'rustup')
  : 'rustup';
const isWindows = process.platform === 'win32';

const checks = [];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${cargoHomeBin}${pathDelimiter}${process.env.PATH ?? ''}`,
      RUSTUP_NO_UPDATE_CHECK: '1'
    }
  });

  return {
    command,
    args,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error
  };
}

function shell(commandLine) {
  const result = spawnSync('sh', ['-lc', commandLine], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${cargoHomeBin}${pathDelimiter}${process.env.PATH ?? ''}`,
      RUSTUP_NO_UPDATE_CHECK: '1'
    }
  });

  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error
  };
}

function addCheck(label, passed, detail) {
  checks.push({ label, passed, detail });
}

function commandExists(command, args) {
  const result = run(command, args);
  return {
    passed: result.status === 0,
    detail:
      result.status === 0
        ? result.stdout
        : result.error?.message || result.stderr || `${command} not found`
  };
}

function checkFile(relativePath) {
  const target = path.join(projectRoot, relativePath);
  addCheck(
    `file:${relativePath}`,
    fs.existsSync(target),
    fs.existsSync(target) ? target : `${target} is missing`
  );
}

const nodeVersion = process.version;
addCheck(
  'node',
  Number.parseInt(nodeVersion.slice(1).split('.')[0], 10) >= 20,
  nodeVersion
);

const cargo = run(cargoExecutable, ['--version']);
addCheck(
  'cargo',
  cargo.status === 0,
  cargo.status === 0
    ? cargo.stdout
    : cargo.error?.message || cargo.stderr || 'cargo not found'
);

const rustup = run(rustupExecutable, ['target', 'list', '--installed']);
addCheck(
  'rustup',
  rustup.status === 0,
  rustup.status === 0
    ? rustup.stdout || 'installed'
    : rustup.error?.message || rustup.stderr || 'rustup not found'
);

if (rustup.status === 0) {
  addCheck(
    'wasm32-wasip2',
    rustup.stdout.split('\n').includes('wasm32-wasip2'),
    rustup.stdout
  );
}

if (!isWindows) {
  const zed = shell('command -v zed');
  addCheck(
    'zed',
    zed.status === 0,
    zed.status === 0
      ? zed.stdout
      : zed.error?.message || zed.stderr || 'zed not found'
  );

  if (
    zed.status === 0 &&
    (zed.stdout.startsWith('/mnt/c/') || zed.stdout.endsWith('.exe'))
  ) {
    addCheck(
      'zed-linux-binary',
      false,
      `Zed resolves to a Windows install at ${zed.stdout}. Use the Linux Zed binary inside WSL for a no-admin extension build.`
    );
  }
}

if (isWindows) {
  const link = commandExists('where', ['link.exe']);
  addCheck(
    'link.exe',
    link.passed,
    link.passed
      ? link.detail
      : 'link.exe not found. Windows builds need Visual Studio Build Tools with the C++ workload.'
  );
}

[
  'extension.toml',
  'Cargo.toml',
  'src/lib.rs',
  'scripts/sidecar.mjs',
  'examples/connections.example.json',
  '.zed/tasks.json'
].forEach(checkFile);

const failures = checks.filter((check) => !check.passed);

for (const check of checks) {
  const prefix = check.passed ? '[ok]' : '[missing]';
  console.log(`${prefix} ${check.label}: ${check.detail}`);
}

if (failures.length > 0) {
  console.error('');
  console.error('Environment is not ready for a full Zed extension build.');
  console.error(
    isWindows
      ? 'Minimum fix path on Windows: install Rust toolchain, install wasm32-wasip2, and install Visual Studio Build Tools with C++ build tools.'
      : 'Minimum fix path on Linux/WSL: use the Linux Zed binary, install rustup, add wasm32-wasip2, and keep the repo on the Linux filesystem.'
  );
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Environment is ready for local extension development.');
}
