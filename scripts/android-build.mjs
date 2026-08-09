import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidRoot = join(projectRoot, 'android');
const environment = process.argv[2] === 'development' ? 'development' : 'production';
const windows = process.platform === 'win32';

function run(command, args, cwd = projectRoot, env = process.env) {
  const isWindowsScript = windows && /\.(?:cmd|bat)$/i.test(command);
  const executable = isWindowsScript ? process.env.ComSpec : command;
  const commandArgs = isWindowsScript
    ? ['/d', '/s', '/c', [command, ...args].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(' ')]
    : args;
  const result = spawnSync(executable, commandArgs, { cwd, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function textFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const entry = join(directory, name);
    if (statSync(entry).isDirectory()) files.push(...textFiles(entry));
    else if (/\.(?:html|js|json|css)$/i.test(name)) files.push(entry);
  }
  return files;
}

function verifyProductionAssets() {
  const assetsRoot = join(androidRoot, 'app', 'src', 'main', 'assets', 'public');
  const contents = textFiles(assetsRoot).map((file) => readFileSync(file, 'utf8')).join('\n');
  const forbidden = /localhost:3001|127\.0\.0\.1|192\.168\.|10\.0\.2\.2|http:\/\/api\.distritobg\.app/i;
  if (forbidden.test(contents)) throw new Error('El paquete contiene una URL local o HTTP prohibida.');
  if (!contents.includes('https://api.distritobg.app')) throw new Error('La API HTTPS de producción no quedó embebida.');

  const capacitor = JSON.parse(readFileSync(join(androidRoot, 'app', 'src', 'main', 'assets', 'capacitor.config.json'), 'utf8'));
  if (capacitor.server?.hostname !== 'delivery.distritobg.app' || capacitor.android?.allowMixedContent !== false) {
    throw new Error('Capacitor no quedó en modo seguro de producción.');
  }
}

const npm = windows ? 'npm.cmd' : 'npm';
const npx = windows ? 'npx.cmd' : 'npx';
const gradle = windows ? 'gradlew.bat' : './gradlew';

if (environment === 'development') {
  run(npm, ['run', 'build:android:development']);
  run(npx, ['cap', 'sync', 'android'], projectRoot, { ...process.env, CAPACITOR_BUILD_ENV: 'development' });
  run(gradle, ['testDebugUnitTest', 'assembleDebug'], androidRoot);
} else {
  run(npm, ['run', 'build:android:release']);
  run(npx, ['cap', 'sync', 'android'], projectRoot, { ...process.env, CAPACITOR_BUILD_ENV: 'production' });
  verifyProductionAssets();
  run(gradle, ['clean', 'testDebugUnitTest', 'assembleRelease', 'bundleRelease'], androidRoot);
  verifyProductionAssets();
}
