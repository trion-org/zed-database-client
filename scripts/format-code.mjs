import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const supportedPrettierExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml'
]);

const ignoredPrefixes = [
  'config/',
  'node_modules/',
  'target/',
  'vscode-database-client/',
  'zed-editor/',
  'zandbox/'
];
const cargoHomeBin = path.join(os.homedir(), '.cargo', 'bin');
const rustfmtExecutable = fs.existsSync(path.join(cargoHomeBin, 'rustfmt'))
  ? path.join(cargoHomeBin, 'rustfmt')
  : 'rustfmt';

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    ...options
  });

  if (typeof result.status === 'number') {
    if (result.status !== 0) {
      process.exit(result.status);
    }

    return;
  }

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail(`Required command "${command}" was not found.`);
    }

    throw result.error;
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env
  });

  if (typeof result.status === 'number') {
    if (result.status !== 0) {
      process.stderr.write(result.stderr ?? '');
      process.exit(result.status);
    }

    return result.stdout ?? '';
  }

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail(`Required command "${command}" was not found.`);
    }

    throw result.error;
  }
}

function getStagedFiles() {
  return capture('git', [
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z'
  ])
    .split('\0')
    .filter(Boolean)
    .filter(
      (filePath) =>
        !ignoredPrefixes.some((prefix) => filePath.startsWith(prefix))
    );
}

function isPrettierFile(filePath) {
  return supportedPrettierExtensions.has(path.extname(filePath));
}

function isRustFile(filePath) {
  return path.extname(filePath) === '.rs';
}

function restage(files) {
  if (files.length === 0) {
    return;
  }

  run('git', ['add', '--', ...files]);
}

function listRustFiles(rootDirectory) {
  const results = [];

  for (const entry of fs.readdirSync(rootDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(rootDirectory, entry.name);
    const relativePath = path.relative(process.cwd(), absolutePath);

    if (ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...listRustFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && isRustFile(relativePath)) {
      results.push(relativePath);
    }
  }

  return results;
}

function formatRustFiles(mode, rustFiles) {
  if (rustFiles.length === 0) {
    return;
  }

  run(rustfmtExecutable, [
    '--edition',
    '2021',
    ...(mode === 'check' ? ['--check'] : []),
    ...rustFiles
  ]);
}

function formatWholeRepo(mode) {
  const prettierArgs = [
    mode === 'write' ? '--write' : '--check',
    '.',
    '--ignore-unknown'
  ];
  const rustFiles = listRustFiles(process.cwd());
  run('prettier', prettierArgs);
  formatRustFiles(mode, rustFiles);
}

function formatStagedFiles(mode) {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log('No staged files to format.');
    return;
  }

  const prettierFiles = stagedFiles.filter(isPrettierFile);
  const rustFiles = stagedFiles.filter(isRustFile);

  if (prettierFiles.length > 0) {
    run('prettier', [
      mode === 'write' ? '--write' : '--check',
      '--ignore-unknown',
      ...prettierFiles
    ]);
  }

  if (rustFiles.length > 0) {
    formatRustFiles(mode, rustFiles);
  }

  if (mode === 'write') {
    restage(stagedFiles);
  }
}

const args = process.argv.slice(2);
const mode = args[0];
const staged = args.includes('--staged');

if (mode !== 'write' && mode !== 'check') {
  fail('Usage: node ./scripts/format-code.mjs <write|check> [--staged]');
}

if (staged) {
  formatStagedFiles(mode);
} else {
  formatWholeRepo(mode);
}
