"use client";
import { useRef, useState } from "react";
import { EventAttendanceProvider, EventPresence } from "@/app/dashboard/event-attendance";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export default function Fixture() {
  const [scenario, setScenario] = useState("normal");
  const state = useRef({ revision: 0, present: [] as string[], calls: [] as ReceptionCommand[], uncertain: false });
  const [calls, setCalls] = useState<ReceptionCommand[]>([]);
  async function commandAction(command: ReceptionCommand): Promise<ReceptionResult> {
    state.current.calls.push(command); setCalls([...state.current.calls]);
    await new Promise(resolve => setTimeout(resolve, 150));
    if (scenario === "forbidden") return { status: "forbidden" };
    if (scenario === "conflict" && command.action !== "inspect") return { status: "conflict" };
    if (command.action !== "inspect") {
      if (!state.current.uncertain) {
        state.current.present = command.action === "cancel" ? [] : command.subjectIds ?? [];
        state.current.revision++;
        (window as unknown as { presenceEntries: Record<string, string> }).presenceEntries = Object.fromEntries(state.current.present.map(subject => [`${id(1)}:${subject === id(1) ? "adult" : subject}`, "2026-10-16T10:00:00Z"]));
      }
      if (scenario === "uncertain" && !state.current.uncertain) { state.current.uncertain = true; return { status: "unavailable" }; }
    }
    return { status: "valid", kind: "family", code: "T001", revision: state.current.revision, registrationStatus: "confirmed", outcome: command.action === "inspect" ? "verified" : "saved", persons: [1, 2].map(n => ({
      id: scenario === "wrong-person" ? id(n + 10) : id(n), kind: n === 1 ? "adult" : "child", firstName: n === 1 ? "Ada" : "Luca", lastName: "Mori", checkedInAt: state.current.present.includes(id(n)) ? "2026-10-16T10:00:00Z" : null,
    })) };
  }
  return <main className="mx-auto max-w-2xl p-4"><label>Scenario<select aria-label="Scenario" value={scenario} onChange={event => setScenario(event.target.value)}>{["normal", "conflict", "uncertain", "forbidden", "wrong-person"].map(value => <option key={value}>{value}</option>)}</select></label>
    <EventAttendanceProvider eventId={id(9)}><div className="border p-3"><p className="font-semibold">Ada Mori</p><p>T001</p>
      <EventPresence eventId={id(9)} registrationId={id(1)} edit={{code:"T001", name:"Ada Mori"}} commandAction={commandAction} />
      <p>Luca Mori · Minore</p><EventPresence eventId={id(9)} registrationId={id(1)} childId={id(2)} />
    </div><div data-readonly><EventPresence eventId={id(9)} registrationId={id(1)} /></div><div data-inactive><EventPresence eventId={id(9)} registrationId={id(1)} inactive edit={{code:"T001",name:"Ada Mori"}} /></div></EventAttendanceProvider>
    <pre data-calls className="hidden">{JSON.stringify(calls)}</pre></main>;
}
