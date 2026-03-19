import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const cargoHomeBin = path.join(os.homedir(), '.cargo', 'bin');
const pathDelimiter = path.delimiter;
const cargoExecutable = fs.existsSync(path.join(cargoHomeBin, 'cargo'))
  ? path.join(cargoHomeBin, 'cargo')
  : 'cargo';

const result = spawnSync(
  cargoExecutable,
  ['build', '--target', 'wasm32-wasip2', '--release'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${cargoHomeBin}${pathDelimiter}${process.env.PATH ?? ''}`,
      RUSTUP_NO_UPDATE_CHECK: '1'
    }
  }
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
