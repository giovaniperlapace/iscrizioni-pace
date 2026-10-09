import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const command = process.argv[2];

if (command !== "dev" && command !== "build") {
  console.error("Uso: node scripts/run-next-staging.mjs <dev|build> [argomenti Next]");
  process.exit(1);
}

const envPath = resolve(".env.staging.local");
let stagingEnv;

try {
  stagingEnv = parseEnv(readFileSync(envPath, "utf8"));
} catch (error) {
  console.error(
    `Impossibile leggere ${envPath}: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

if (stagingEnv.DEPLOYMENT_ENVIRONMENT !== "staging") {
  console.error("Avvio bloccato: .env.staging.local non dichiara lo staging.");
  process.exit(1);
}

const nextCli = resolve("node_modules/next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextCli, command, ...process.argv.slice(3)],
  {
    env: { ...process.env, ...stagingEnv },
    stdio: "inherit",
  }
);

child.on("error", (error) => {
  console.error(`Impossibile avviare Next in staging: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
