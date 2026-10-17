"use client";

import { useRef } from "react";
import type { RecentReception } from "@/lib/reception/station";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
import { useQrLabelPrinting } from "../qr-label-panel";

export function RecentPersonActions({ item, printing, labelCommandAction, disabled, onBusyChange, onAction, onPrinted }: {
  item: RecentReception;
  printing: boolean;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onPrinted: () => void;
  onAction: (action: "presence" | "remove" | "print") => Promise<boolean>;
}) {
  const running = useRef(false);
  const person = item.result.kind === "family" ? item.result.persons[0] : null;
  const labels = useQrLabelPrinting({ scope: { registrationId: person?.id ?? "" }, commandAction: labelCommandAction, enabled: printing && !!person, onBusyChange });
  async function act(action: "presence" | "remove" | "print") {
    if (disabled || labels.busy || running.current) return;
    running.current = true;
    try {
      const readyToPrint = await onAction(action);
      if (action === "print" && readyToPrint) { await labels.print([person!.id]); onPrinted(); }
    } finally { running.current = false; }
  }
  return <div className="grid gap-2">
    <p className={`text-sm ${person?.checkedInAt ? "font-semibold text-green-800" : "text-[var(--peace-muted)]"}`}>{person?.checkedInAt ? "Partecipazione confermata" : "Partecipazione non confermata"}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary min-h-11 px-4 text-sm" disabled={disabled || labels.busy} onClick={() => void act(person?.checkedInAt ? "remove" : "presence")}>{person?.checkedInAt ? "Rimuovi presenza" : "Conferma partecipazione"}</button>
      {printing && <button type="button" className="btn-secondary min-h-11 px-4 text-sm" disabled={disabled || labels.busy} onClick={() => void act("print")}>Stampa QR</button>}
    </div>
    {labels.message && <p role={labels.failed ? "alert" : "status"} className="text-sm">{labels.message}</p>}
  </div>;
}
