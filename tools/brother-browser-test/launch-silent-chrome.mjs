// Dedicated Chrome profile; does not edit Chrome policies or personal profiles.
// Only two per-user Brother queue defaults are adjusted, with an explicit restore.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const root = path.join(os.tmpdir(), 'iscrizioni-pace-silent-print-20261012');
const backupPath = path.join(root, 'queue-options-before.json');
mkdirSync(root, { recursive: true, mode: 0o700 });
const printer = 'Brother_QL_810W';
const calibrating = process.argv.includes('--calibrate');
if (process.argv.includes('--restore-printer')) {
  if (!existsSync(backupPath)) throw new Error('Nessuna configurazione precedente salvata');
  const saved = JSON.parse(readFileSync(backupPath, 'utf8'));
  for (const key of ['PageSize', 'CutMedia']) {
    execFileSync('lpoptions', ['-p', printer, ...(saved[key] === null ? ['-r', key] : ['-o', `${key}=${saved[key]}`])]);
  }
  console.log('Impostazioni precedenti della Brother ripristinate.');
  process.exit(0);
}
const before = execFileSync('lpoptions', ['-p', printer], { encoding: 'utf8' });
if (!existsSync(backupPath)) {
  const saved = Object.fromEntries(['PageSize', 'CutMedia'].map(key => [key, before.match(new RegExp(`(?:^|\\s)${key}=([^\\s]+)`))?.[1] ?? null]));
  writeFileSync(backupPath, JSON.stringify(saved, null, 2), { mode: 0o600 });
}
execFileSync('lpoptions', ['-p', printer, '-o', 'PageSize=29x90mm', '-o', 'CutMedia=EndOfPage']);
const profile = path.join(root, 'chrome-profile');
const profileDefault = path.join(profile, 'Default');
mkdirSync(profileDefault, { recursive: true });
const prefsPath = path.join(profileDefault, 'Preferences');
if (!existsSync(prefsPath)) {
  const state = {
    version: 2,
    recentDestinations: [{ id: printer, origin: 'local', account: '' }],
    selectedDestinationId: printer,
    mediaSize: { width_microns: 29000, height_microns: 90000, name: '29x90mm' },
    marginsType: 1, scalingType: 3, scaling: '100', copies: 1,
    isHeaderFooterEnabled: false, isLandscapeEnabled: false, isCssBackgroundEnabled: true,
    isDuplexEnabled: false, isColorEnabled: false,
  };
  writeFileSync(prefsPath, JSON.stringify({ printing: { print_preview_sticky_settings: { appState: JSON.stringify(state) } } }), { mode: 0o600 });
}
if (!calibrating) {
  const preferences = JSON.parse(readFileSync(prefsPath, 'utf8'));
  const saved = JSON.parse(preferences.printing?.print_preview_sticky_settings?.appState ?? '{}');
  if (saved.mediaSize?.width_microns !== 29000 || saved.mediaSize?.height_microns !== 90000 || !saved.mediaSize?.vendor_id ||
      saved.marginsType !== 1 || saved.scaling !== '100' || saved.isHeaderFooterEnabled !== false) {
    throw new Error('Stampa silenziosa bloccata: prima calibrare il profilo con --calibrate e verificare una sola pagina 29 × 90 mm.');
  }
}
const child = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  `--user-data-dir=${profile}`, ...(calibrating ? [] : ['--kiosk-printing']), '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=3169', '--remote-debugging-address=127.0.0.1',
  '--disable-background-networking', '--disable-sync',
  `--app=http://127.0.0.1:3159/${calibrating ? 'silent-label-document.html' : 'silent-label-test.html'}`,
], { detached: true, stdio: 'ignore' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.unref();
console.log(calibrating ? 'Finestra di calibrazione aperta senza stampa automatica.' : 'Finestra Chrome di collaudo aperta; nessuna stampa inviata automaticamente.');
console.log('Profilo dedicato:', profile);
console.log('Per ripristinare la Brother: node tools/brother-browser-test/launch-silent-chrome.mjs --restore-printer');
