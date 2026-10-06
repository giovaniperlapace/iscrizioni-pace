"use client";

import { useState } from "react";
import type { ReceptionDuty } from "@/lib/reception/duties.server";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import { ReceptionConsole } from "./reception-console";

export function ReceptionWorkstation({ duties, commandAction }: {
  duties: ReceptionDuty[];
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
}) {
  const [selected, setSelected] = useState<string | null>(() => duties.length === 1 ? duties[0].key : null);
  const duty = duties.find(item => item.key === selected);
  if (!duty) return <section className="surface-card grid gap-4 p-5">
    <h2 className="text-xl font-semibold">Scegli l’incarico prima di iniziare</h2>
    {duties.length ? duties.map(item => <button key={item.key} type="button" className="btn-secondary min-h-16 px-4 py-3 text-left"
      onClick={() => setSelected(item.key)}>
      <span className="block font-semibold">{item.duty === "event_entry" ? "Ingresso evento" : item.duty === "panel_entry" ? "Ingresso panel" : "Assistenza in sala"} · {item.title}</span>
      {item.room && <span className="block text-sm">{item.room}</span>}
    </button>) : <p role="alert">Nessun incarico autorizzato nell’evento corrente. Rivolgiti a un amministratore.</p>}
  </section>;
  // Remounting discards the previous duty's in-memory QR/history. The console
  // permits changing only between completed operations, never on an uncertain result.
  return <ReceptionConsole key={duty.key} duty={duty} commandAction={commandAction}
    onChangeDuty={duties.length > 1 ? () => setSelected(null) : undefined} />;
}
