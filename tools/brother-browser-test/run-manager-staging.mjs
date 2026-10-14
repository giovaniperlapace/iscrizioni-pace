// Run the actual application against verified staging, with local callback URLs.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { validateStagingReadiness, formatStagingReadinessReport } from '../../lib/deployment/staging-readiness.ts';
const env = parseEnv(readFileSync('.env.staging.local', 'utf8'));
const base = 'http://127.0.0.1:3161';
const localEnv = { ...env, NEXT_PUBLIC_APP_URL: base, APP_URL: base, PUBLIC_SITE_URL: base };
const readiness = validateStagingReadiness(localEnv);
console.log(formatStagingReadinessReport(readiness));
if (!readiness.ok) process.exit(1);
console.log('Dashboard Manager locale, dati staging, email in modalità log.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3161'], {
  env: { ...process.env, ...localEnv }, stdio: 'inherit',
});
child.on('exit', code => { process.exitCode = code ?? 1; });
