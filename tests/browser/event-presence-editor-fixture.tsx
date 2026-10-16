"use client";
import { useCallback, useRef, useState } from "react";
import { EventAttendanceProvider, EventPresence } from "@/app/dashboard/event-attendance";
import { ParticipantReceptionPanel } from "@/app/dashboard/participant-reception-panel";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export default function Fixture({ html, family = false }: { html: string; family?: boolean }) {
  const scenario = useRef("normal");
  const state = useRef({ revision: 0, present: [] as string[], calls: [] as ReceptionCommand[], uncertain: false, attempts: 0 });
  const [calls, setCalls] = useState<ReceptionCommand[]>([]);
  const [prints, setPrints] = useState<LabelCommand[]>([]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const commandAction = useCallback(async (command: ReceptionCommand): Promise<ReceptionResult> => {
    state.current.calls.push(command); setCalls([...state.current.calls]);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (scenario.current === "forbidden") return { status: "forbidden" };
    if (scenario.current === "conflict" && command.action !== "inspect") return { status: "conflict" };
    if (command.action !== "inspect") {
      if (!state.current.uncertain) {
        state.current.present = command.action === "cancel" ? [] : command.subjectIds ?? [];
        state.current.revision++;
        (window as unknown as { presenceEntries: Record<string, string> }).presenceEntries = Object.fromEntries(state.current.present.map(subject => [`${id(1)}:${subject === id(1) ? "adult" : subject}`, "2026-10-16T10:00:00Z"]));
      }
      if (scenario.current === "uncertain" && !state.current.uncertain) { state.current.uncertain = true; return { status: "unavailable" }; }
    }
    return { status: "valid", kind: "family", code: "T001", revision: state.current.revision, registrationStatus: "confirmed", outcome: command.action === "inspect" ? "verified" : "saved", persons: (family ? [1, 2] : [1]).map(n => ({
      id: scenario.current === "wrong-person" ? id(n + 10) : id(n), kind: n === 1 ? "adult" : "child", firstName: n === 1 ? "Ada" : "Luca", lastName: "Mori", checkedInAt: state.current.present.includes(id(n)) ? "2026-10-16T10:00:00Z" : null,
    })) };
  }, [family]);
  const labelCommandAction = useCallback(async (command: LabelCommand): Promise<LabelResult> => {
    setPrints(old => [...old, command]); await new Promise(resolve => setTimeout(resolve, 150));
    if (scenario.current === "print-error") return { status: "unavailable" };
    if (command.action === "request") { state.current.attempts++; return { status: "document", requestId: command.requestId!, html }; }
    return { status: "queue", snapshot: "a".repeat(64), items: [{ registrationId: id(1), name: "Ada Mori", code: "T001", state: "pending", attempts: state.current.attempts, outcome: null, reason: null, changed: false }] };
  }, [html]);
  return <main className="mx-auto w-full max-w-2xl p-4"><label>Scenario<select aria-label="Scenario" onChange={event => { scenario.current = event.target.value; }}>{["normal", "conflict", "uncertain", "forbidden", "wrong-person", "print-error"].map(value => <option key={value}>{value}</option>)}</select></label>
    <EventAttendanceProvider eventId={id(9)}><div data-row className="border p-3"><p className="font-semibold">Ada Mori</p><p>T001</p>
      <EventPresence eventId={id(9)} registrationId={id(1)} />
      {family && <><p>Luca Mori · Minore</p><EventPresence eventId={id(9)} registrationId={id(1)} childId={id(2)} /></>}
    </div><div data-inactive><EventPresence eventId={id(9)} registrationId={id(1)} inactive /></div>
    <button disabled={busy} onClick={() => setOpen(!open)}>{open ? "Chiudi riquadro" : "Apri riquadro"}</button>
    {open && <ParticipantReceptionPanel eventId={id(9)} registrationId={id(1)} code="T001" commandAction={commandAction} labelCommandAction={labelCommandAction} onBusyChange={setBusy} />}
    </EventAttendanceProvider>
    <pre data-calls hidden>{JSON.stringify(calls)}</pre><pre data-prints hidden>{JSON.stringify(prints)}</pre></main>;
}
