/* global console, process */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];

if (!['electron', 'node'].includes(mode)) {
  console.error('Usage: node scripts/install-native.mjs <electron|node>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleDir = join(rootDir, 'node_modules', 'better-sqlite3');
const prebuildInstallBin = require.resolve('prebuild-install/bin.js', { paths: [rootDir] });

const target =
  mode === 'electron'
    ? require(join(rootDir, 'node_modules', 'electron', 'package.json')).version
    : process.versions.node;

const args = [
  prebuildInstallBin,
  '--runtime',
  mode,
  '--target',
  target,
  '--arch',
  process.arch,
  '--platform',
  process.platform
];

console.log(
  `Installing better-sqlite3 prebuild for ${mode} ${target} (${process.platform}-${process.arch})`
);

const result = spawnSync(process.execPath, args, {
  cwd: moduleDir,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
