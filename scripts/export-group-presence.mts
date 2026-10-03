import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSupabaseServiceClient } from "../lib/supabase/service.ts";
import { getCurrentOperationalEvent } from "../lib/events/current.ts";
import { presenceConfigForEvent } from "../lib/presence-exports/config.ts";
import { loadPresenceSource } from "../lib/presence-exports/data.server.ts";
import { buildPresenceReport } from "../lib/presence-exports/report.ts";
import { writePresenceWorkbook } from "../lib/presence-exports/workbook.ts";
import { PRESENCE_EXPORTS } from "../lib/presence-exports/catalog.ts";

// Read-only administrative CLI. Uses environment credentials, never prints them.
// node --env-file=.env.local scripts/export-group-presence.mts [output-directory]
const db = createSupabaseServiceClient();
const event = await getCurrentOperationalEvent(db, "id,title,starts_on,ends_on");
if (!event) throw new Error("Nessun evento corrente disponibile");
const config = presenceConfigForEvent(event.id);
if (!config) throw new Error("Raccordo non configurato per l’evento corrente");
const source = await loadPresenceSource(db, { id: event.id, title: event.title,
  starts_on: event.starts_on ?? null, ends_on: event.ends_on ?? null }, true);
const destination = resolve(process.argv[2] ?? "output/presence-exports");
await mkdir(destination, { recursive: true });
for (const variant of PRESENCE_EXPORTS) {
  const report = buildPresenceReport(source, config, variant.key);
  const path = resolve(destination, `presenze_${variant.key}.xlsx`);
  await writeFile(path, await writePresenceWorkbook(report));
  console.log(`${path}: ${report.total[0]} persone; ${report.warnings.length} avvisi`);
}
