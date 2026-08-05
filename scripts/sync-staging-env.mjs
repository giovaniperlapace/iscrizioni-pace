import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const options = parseArguments(process.argv.slice(2));
const stackId = options["stack-id"];
const appUrl = options["app-url"] || "http://localhost:3000";
const sshHost = process.env.SERVER_SSH_HOST;
const sshPort = process.env.SERVER_SSH_PORT || "22";
const sshUser = process.env.SERVER_SSH_USER || "root";
const sshKey = options["ssh-key"] || process.env.SERVER_SSH_KEY;

if (!stackId || !/^[A-Za-z0-9_-]+$/.test(stackId)) {
  fail("Passare --stack-id con l'identificativo Coolify staging.");
}

if (!sshHost || !sshKey || !sshKey.startsWith("/")) {
  fail("Configurare SERVER_SSH_HOST e un path SSH assoluto con --ssh-key.");
}

const normalizedAppUrl = normalizeAppUrl(appUrl);
const outputPath = resolve(".env.staging.local");
const existing = existsSync(outputPath)
  ? parseEnv(readFileSync(outputPath, "utf8"))
  : {};

let remoteText;

try {
  remoteText = execFileSync(
    "ssh",
    [
      "-i",
      resolve(sshKey),
      "-o",
      "BatchMode=yes",
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-p",
      sshPort,
      `${sshUser}@${sshHost}`,
      `cat '/data/coolify/services/${stackId}/.env'`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
} catch {
  fail("Impossibile leggere in sicurezza la configurazione Coolify staging.");
}

const remote = parseEnv(remoteText);
const supabaseUrl = pick(remote, [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_PUBLIC_URL",
  "SERVICE_URL_SUPABASEKONG",
]);
const anonKey = pick(remote, [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "SERVICE_SUPABASEANON_KEY",
]);
const serviceRoleKey = pick(remote, [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_SUPABASESERVICE_KEY",
]);

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  fail("Lo stack Coolify non espone ancora URL e chiavi Supabase staging.");
}

const values = {
  DEPLOYMENT_ENVIRONMENT: "staging",
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  QR_TOKEN_ENCRYPTION_SECRET:
    existing.QR_TOKEN_ENCRYPTION_SECRET || randomBytes(48).toString("hex"),
  NEXT_PUBLIC_APP_URL: normalizedAppUrl,
  APP_URL: normalizedAppUrl,
  PUBLIC_SITE_URL: normalizedAppUrl,
  EMAIL_DELIVERY_MODE: "log",
  EMAIL_FROM: "registrationspeace+staging@santegidio.org",
  EMAIL_USER: "",
  EMAIL_PASSWORD: "",
  SMTP_HOST: "",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_POOL: "false",
  SMTP_MAX_CONNECTIONS: "1",
  SMTP_MAX_MESSAGES: "10",
  CRON_SECRET: existing.CRON_SECRET || randomBytes(48).toString("hex"),
  SERVER_SSH_HOST: sshHost,
  SERVER_SSH_PORT: sshPort,
  SERVER_SSH_USER: sshUser,
  SERVER_SSH_KEY: resolve(sshKey),
  SUPABASE_COOLIFY_STACK_ID: stackId,
  SUPABASE_DB_CONTAINER: `supabase-db-${stackId}`,
  SUPABASE_DB_USER: "postgres",
  SUPABASE_DB_NAME: "postgres",
};

const fileContents = [
  "# Generato da npm run staging:sync-env. Non committare.",
  ...Object.entries(values).map(([name, value]) =>
    `${name}=${JSON.stringify(value)}`
  ),
  "",
].join("\n");

writeFileSync(outputPath, fileContents, { mode: 0o600 });
console.log(
  `Configurazione staging sincronizzata in ${outputPath} (${Object.keys(values).length} variabili, valori non mostrati).`
);

function parseArguments(args) {
  const result = {};

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];

    if (!name?.startsWith("--") || value === undefined) {
      fail("Argomenti non validi per staging:sync-env.");
    }

    result[name.slice(2)] = value;
  }

  return result;
}

function parseEnv(text) {
  const result = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result[name] = value;
  }

  return result;
}

function pick(source, names) {
  for (const name of names) {
    const value = resolveEnvReference(source, source[name]);
    if (value) return value;
  }

  return null;
}

function resolveEnvReference(source, initialValue) {
  let value = initialValue;
  const visited = new Set();

  while (value) {
    const reference = value.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
    if (!reference) return value;

    const name = reference[1];
    if (visited.has(name)) return null;
    visited.add(name);
    value = source[name];
  }

  return null;
}

function normalizeAppUrl(value) {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    fail("--app-url deve essere un URL valido.");
  }
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
