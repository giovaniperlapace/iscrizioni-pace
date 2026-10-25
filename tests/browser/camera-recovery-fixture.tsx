"use client";
// Local-only fixture: exercise the original console/session/camera with synthetic results.
import { useRef, useState } from "react";
import { EventReceptionConsole } from "@/app/dashboard/accoglienza/event-reception-console";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionDuty } from "@/lib/reception/duties.server";

const id = "11111111-1111-4111-8111-111111111111";
export default function Fixture() {
  const [duty, setDuty] = useState<ReceptionDuty["duty"]>("ceremony_entry");
  const [deviceMode, setDeviceMode] = useState<"phone" | "computer">("phone");
  const [scenario, setScenario] = useState("missing-ticket");
  const mode = useRef(scenario);
  const frame = useRef<string | null>(null);
  const camera = useRef<Parameters<CameraSource>[0] | null>(null);
  const oldCamera = useRef<Parameters<CameraSource>[0] | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const [calls, setCalls] = useState<ReceptionCommand[]>([]);
  const [starts, setStarts] = useState(0);
  const [stops, setStops] = useState(0);
  const [source] = useState<CameraSource>(() => async (options: Parameters<CameraSource>[0]) => {
    oldCamera.current = camera.current; camera.current = options;
    if (mode.current === "denied") throw new DOMException("Synthetic", "NotAllowedError");
    setStarts(n => n + 1);
    const timer = setInterval(() => frame.current ? options.onCode(frame.current) : options.onNoCode?.(), 100);
    let stopped = false;
    const stop = () => { if (stopped) return; stopped = true; clearInterval(timer); setStops(n => n + 1); };
    options.signal.addEventListener("abort", stop, { once: true });
    return stop;
  });
  async function commandAction(command: ReceptionCommand): Promise<ReceptionResult> {
    setCalls(values => [...values, command]);
    const scenario = mode.current;
    if (scenario === "pending" || scenario === "pending-write" && command.action !== "inspect") await new Promise<void>(resolve => { pending.current = resolve; });
    if (scenario === "invalid") return { status: "invalid" };
    if (scenario === "not-booked") return { status: "not_booked" };
    if (scenario === "wrong-forum") return { status: "not_booked", routes: [{ title: "Altro Forum", room: "Sala B" }] };
    if (scenario === "blocked") return { status: "forbidden" };
    if (scenario === "uncertain" || scenario === "uncertain-write" && command.action !== "inspect") return { status: "unavailable" };
    if (scenario === "conflict" && command.action !== "inspect") return { status: "conflict" };
    if (scenario === "capacity" && command.action !== "inspect") return { status: "capacity_exceeded" };
    const checkedInAt = command.action !== "inspect" || scenario === "entered" ? "2026-10-25T12:00:00Z" : null;
    if (scenario === "school") return { status: "valid", kind: "school", outcome: "verified", revision: 1, registrationStatus: "submitted", schoolName: "Scuola prova", classDescription: "1A", expectedStudents: 20, expectedCompanions: 2, students: 0, companions: 0, checkedInAt: null };
    return { status: "valid", kind: "family", outcome: command.action === "inspect" ? "verified" : "saved", revision: 1, registrationStatus: "confirmed", code: command.lookup.value[0] === "a" ? "AAAA" : "BBBB", persons: [
      { id, kind: "adult", firstName: command.lookup.value[0] === "a" ? "Anna" : "Bruno", lastName: "Prova", checkedInAt, eligible: scenario !== "missing-ticket", eventCheckedIn: scenario !== "missing-event" },
      ...(scenario === "family" ? [{ id: "22222222-2222-4222-8222-222222222222", kind: "child" as const, firstName: "Luca", lastName: "Prova", checkedInAt: null }] : []),
    ] };
  }
  const context: ReceptionDuty = duty === "registration_check"
    ? { key: duty, duty, title: "Incarico prova", room: null }
    : duty === "event_entry" ? { key: duty, duty, title: "Incarico prova", room: null }
    : { key: duty, duty, panelId: duty === "ceremony_entry" ? "opening" : id, title: "Incarico prova", room: null };
  return <main className="app-page p-4">
    <label>Postazione test<select aria-label="Postazione test" value={deviceMode} onChange={e => setDeviceMode(e.target.value as "phone" | "computer")}><option>phone</option><option>computer</option></select></label>
    <label>Incarico test<select aria-label="Incarico test" value={duty} onChange={e => setDuty(e.target.value as ReceptionDuty["duty"])}>{["ceremony_entry", "panel_entry", "registration_check", "event_entry", "room_assistance"].map(value => <option key={value}>{value}</option>)}</select></label>
    <label>Scenario test<select aria-label="Scenario test" value={scenario} onChange={e => { mode.current = e.target.value; setScenario(e.target.value); }}>{["missing-ticket", "normal", "invalid", "not-booked", "wrong-forum", "missing-event", "family", "school", "entered", "pending", "pending-write", "uncertain", "uncertain-write", "blocked", "conflict", "capacity", "denied"].map(value => <option key={value}>{value}</option>)}</select></label>
    <button onClick={() => { frame.current = "a".repeat(43); }}>QR A</button>
    <button onClick={() => { frame.current = "b".repeat(43); }}>QR B</button>
    <button onClick={() => { frame.current = null; }}>Nessun QR</button>
    <button onClick={() => camera.current?.onError()}>Interrompi dispositivo</button>
    <button onClick={() => oldCamera.current?.onCode("b".repeat(43))}>Callback obsoleta</button>
    <button onClick={() => pending.current?.()}>Completa richiesta</button>
    <output className="block break-all" data-calls>{JSON.stringify(calls)}</output><output data-starts>{starts}</output><output data-stops>{stops}</output>
    <EventReceptionConsole key={`${duty}-${deviceMode}`} duty={context} deviceMode={deviceMode} commandAction={commandAction} cameraSource={source}/>
  </main>;
}
