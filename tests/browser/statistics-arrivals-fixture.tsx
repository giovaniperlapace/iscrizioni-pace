"use client";
import { useEffect, useRef, useState } from "react";
import { StatisticsSection } from "@/app/dashboard/statistics-section";
import { buildEventStatisticsSnapshot } from "@/lib/registrations/event-statistics";
import type { StatisticsReport } from "@/lib/registrations/statistics-reports";
const eventId = "11111111-1111-4111-8111-111111111111";
const statistics = buildEventStatisticsSnapshot({ participants: [], groups: [], attendanceChoices: [] });
export default function Fixture() {
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<StatisticsReport>("territory");
  const server = useRef({ version: 1, forbidden: false });
  useEffect(() => {
    const original = window.fetch;
    const reads: string[] = [];
    (window as unknown as { __arrivalReads: string[] }).__arrivalReads = reads;
    window.fetch = async (input, options) => {
      const url = new URL(String(input), window.location.origin);
      if (!url.pathname.startsWith("/dashboard/attendance")) return original(input, options);
      reads.push(url.pathname);
      if (server.current.forbidden) return new Response("{}", { status: 403 });
      const adults = server.current.version;
      if (url.pathname.endsWith("/report")) return Response.json({ eventId, updatedAt: new Date().toISOString(),
        day: url.searchParams.get("day") || null, part: url.searchParams.get("part") || "all",
        expected: { adults: 5, children: 0, students: 0, companions: 0, schoolBookings: 0 },
        arrivals: { adults, children: 0, students: 0, companions: 0, schoolBookings: 0 },
        operations: { duplicateRequests: 0, retries: 0, corrections: 0, cancellations: 0 }, hours: [] });
      return Response.json({ eventId, updatedAt: new Date().toISOString(), entries: {}, schoolEntries: {},
        totals: { adults, children: 0, students: 0, companions: 0, schoolBookings: 0, people: adults } });
    };
    let active = true;
    queueMicrotask(() => { if (active) setReady(true); });
    return () => { active = false; window.fetch = original; };
  }, []);
  return <main className="mx-auto grid max-w-5xl gap-4 p-4">
    <h1>Statistiche sintetiche</h1>
    <div className="flex gap-3"><button onClick={() => { server.current.version++; }}>Simula nuovi ingressi</button><button onClick={() => { server.current.forbidden = true; }}>Simula accesso revocato</button></div>
    <div onClickCapture={event => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('nav[aria-label="Categorie di statistiche"] a');
      if (!anchor) return;
      const next = new URL(anchor.href).searchParams.get("report") as StatisticsReport;
      if (next === report) return; // The active report handles its own refresh.
      event.preventDefault(); event.stopPropagation(); setReport(next);
    }}>{ready ? <StatisticsSection eventId={eventId} statistics={statistics} report={report} dashboard="admin" navMode="mini" /> : null}</div>
  </main>;
}
