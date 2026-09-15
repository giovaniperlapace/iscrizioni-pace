import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadAllRows, loadRowsForIds } from "@/lib/supabase/all-rows";
import Link from "@/components/pending-link";

/** Notifications are audit records, never changes to the participant's assignment. */
export async function GroupAssignmentReports({ dashboard, eventId }: {
  dashboard: "admin" | "manager"; eventId: string | null;
}) {
  const auth = await getCurrentAuthContext(await createSupabaseServerClient(), dashboard);
  if (!eventId || !auth?.eventRoles.some(role =>
    (role.role === "admin" && role.eventId === null) ||
    (role.role === "manager" && role.eventId === eventId))) return null;
  const db = createSupabaseServiceClient();
  let rows: ReportRow[];
  try {
    const { data: reports } = await loadAllRows<{ entity_id: string }>((from, to) => db
      .from("audit_logs").select("entity_id").eq("event_id", eventId)
      .eq("action", "group_leader.assignment_reported").order("id").range(from, to));
    const { data: assignments } = await loadRowsForIds(reports.map(r => r.entity_id), (ids, from, to) => db
      .from("participant_group_assignments")
      .select("id,registration_id,groups!participant_group_assignments_group_id_fkey(name),registrations!inner(event_id,deleted_at,participants(first_name,last_name))")
      .in("id", ids).eq("is_current", true).eq("registrations.event_id", eventId)
      .is("registrations.deleted_at", null).order("id").range(from, to));
    if (!assignments.length) return null;
    rows = assignments as unknown as ReportRow[];
  } catch {
    return <p role="alert" className="rounded-md border p-3 text-sm">Impossibile caricare le segnalazioni dei capigruppo. Ricarica la pagina per riprovare.</p>;
  }
  return <details className="rounded-md border border-[var(--peace-border)] p-4" open>
    <summary className="cursor-pointer text-sm font-semibold">Segnalazioni dei capigruppo ({rows.length})</summary>
    <p className="mt-2 text-sm text-[var(--peace-muted)]">Verifica l’appartenenza al gruppo. Le segnalazioni non modificano le assegnazioni; solo Manager e Admin possono cambiarle.</p>
    <ul className="mt-3 grid max-h-64 gap-2 overflow-auto text-sm">
      {rows.map(row => {
        const registration = one(row.registrations);
        const person = one(registration?.participants);
        return <li key={row.id}><Link className="underline underline-offset-4" href={`/dashboard/${dashboard}?section=iscritti&edit=${encodeURIComponent(row.registration_id)}`}>
          {person ? `${person.first_name} ${person.last_name}` : "Apri partecipante"}
        </Link> — {one(row.groups)?.name ?? "Gruppo"}</li>;
      })}
    </ul>
  </details>;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type Person = { first_name: string; last_name: string };
type ReportRegistration = { participants: Person | Person[] | null };
type ReportRow = {
  id: string;
  registration_id: string;
  groups: { name: string } | { name: string }[] | null;
  registrations: ReportRegistration | ReportRegistration[];
};
