import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { loadAttendanceSummaries } from "./attendance-summary.server.ts";
import { attendanceSummary, attendanceTableColumns } from "./attendance-summary.ts";
import type { AssociationStatisticsSnapshot } from "./association-statistics.ts";

// Caller must authorize Admin, Manager or Manager Viewer for this event.
export async function loadAssociationStatistics(
  db: SupabaseClient,
  eventId: string,
  startsOn: string | null,
  endsOn: string | null,
): Promise<AssociationStatisticsSnapshot> {
  const { data: active } = await loadAllRows((from, to) => db.from("registrations")
    .select("id").eq("event_id", eventId).is("deleted_at", null).order("id").range(from, to));
  const { data: answers } = await loadRowsForIds(active.map(row => row.id), (ids, from, to) => db
    .from("registration_questionnaire_answers")
    .select("registration_id,association:answers->externalGroupAssociation")
    .eq("event_id", eventId).in("registration_id", ids)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to));
  // The latest questionnaire wins, including an empty answer. Never revive an older declaration.
  const associations = new Map<string, string>();
  for (const answer of answers) {
    if (!associations.has(answer.registration_id)) {
      associations.set(answer.registration_id, typeof answer.association === "string" ? answer.association.trim() : "");
    }
  }
  const ids = active.filter(row => associations.get(row.id)).map(row => row.id);
  if (!ids.length) return { people: [] };
  const { data: registrations } = await loadRowsForIds(ids, (batch, from, to) => db.from("registrations")
    .select("id,participants(first_name,last_name)").in("id", batch)
    .eq("event_id", eventId).is("deleted_at", null).order("id").range(from, to));
  const attendance = await loadAttendanceSummaries(db, registrations.map(row => row.id));
  const slots = attendanceTableColumns(startsOn, endsOn);
  return { people: registrations.map(row => {
    const participant = row.participants as unknown as { first_name: string | null; last_name: string | null } | null;
    const choices = attendance.get(row.id) ?? [];
    const normalized = slots.filter(slot => choices.some(choice => choice.choice === "yes" && choice.day === slot.day && (!choice.day_part || choice.day_part === slot.part)))
      .map(slot => ({ day: slot.day, day_part: slot.part, choice: "yes" }));
    const unknown = !choices.length || choices.some(choice => choice.choice === "unknown");
    return {
      registrationId: row.id,
      name: [participant?.first_name, participant?.last_name].filter(Boolean).join(" ").trim() || "Nome non disponibile",
      association: associations.get(row.id)!,
      attendance: !normalized.length && !unknown ? "Nessuna presenza prevista"
        : attendanceSummary([...normalized, ...(unknown ? [{ day: "", day_part: "", choice: "unknown" }] : [])]),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "it") || a.registrationId.localeCompare(b.registrationId)) };
}
