"use client";

import { useState } from "react";
import type { ReceptionDuty } from "@/lib/reception/duties.server";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import { ReceptionConsole } from "./reception-console";
import PendingLink from "@/components/pending-link";
import type { CameraSource } from "@/lib/reception/camera";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";

export function ReceptionWorkstation({ duties, commandAction, cameraSource, labelCommandAction }: {
  cameraSource?: CameraSource;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>;
  duties: ReceptionDuty[];
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
}) {
  const [deviceMode, setDeviceMode] = useState<"computer" | "phone" | null>(null);
  const [selected, setSelected] = useState<string | null>(() => duties.length === 1 ? duties[0].key : null);
  const duty = duties.find(item => item.key === selected);
  if (duties.length && !deviceMode) return <section className="surface-card grid gap-4 p-5" aria-labelledby="reception-mode-title">
    <h2 id="reception-mode-title" className="text-xl font-semibold">Che modalità vuoi usare?</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" className="btn-secondary min-h-24 px-4 py-3 text-left" onClick={() => setDeviceMode("computer")}>
        <span className="block font-semibold">Computer · scanner USB e stampa</span>
        <span className="block text-sm">Leggi i QR con la pistola, gestisci le presenze e stampa le etichette.</span>
      </button>
      <button type="button" className="btn-secondary min-h-24 px-4 py-3 text-left" onClick={() => setDeviceMode("phone")}>
        <span className="block font-semibold">Telefono · fotocamera e presenze</span>
        <span className="block text-sm">Inquadra i QR con la fotocamera e gestisci le presenze. Stampa non disponibile.</span>
      </button>
    </div>
  </section>;
  if (!duty) return <section className="surface-card grid gap-4 p-5">
    <h2 className="text-xl font-semibold">Scegli l’incarico prima di iniziare</h2>
    {deviceMode && <button type="button" className="min-h-11 justify-self-start underline" onClick={() => setDeviceMode(null)}>Cambia modalità</button>}
    {duties.length ? duties.map(item => <button key={item.key} type="button" className="btn-secondary min-h-16 px-4 py-3 text-left"
      onClick={() => setSelected(item.key)}>
      <span className="block font-semibold">{item.duty === "event_entry" ? "Ingresso evento" : item.duty === "panel_entry" ? "Ingresso panel" : "Assistenza in sala"} · {item.title}</span>
      {item.room && <span className="block text-sm">{item.room}</span>}
    </button>) : <p role="alert">Nessun incarico autorizzato nell’evento corrente. Rivolgiti a un amministratore.</p>}
  </section>;
  // Remounting discards the previous duty's in-memory QR/history. The console
  // permits changing only between completed operations, never on an uncertain result.
  return <>
    <ReceptionConsole key={`${deviceMode}-${duty.key}`} duty={duty} commandAction={commandAction}
    deviceMode={deviceMode ?? "phone"} cameraSource={cameraSource} labelCommandAction={labelCommandAction}
    onChangeMode={() => setDeviceMode(null)}
    eventReception={duty.duty === "event_entry"}
    labelPrinting={deviceMode === "computer" && duty.duty === "event_entry"}
    onChangeDuty={duties.length > 1 ? () => setSelected(null) : undefined} />
    {deviceMode === "computer" && <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Strumenti stampante</summary><PendingLink className="min-h-11 underline" href="/dashboard/accoglienza/collaudo">Collaudo stampante con campioni sintetici</PendingLink></details>}
  </>;
}
