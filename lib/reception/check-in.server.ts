import type { SupabaseClient } from "@supabase/supabase-js";
import { hashQrToken } from "../qrcode/token.ts";
import { parseReceptionCommand, type ReceptionResult } from "./contracts.ts";

// No log of the command, token, RPC error/detail or returned identities.
// The injected service client is created only after session verification.
export async function executeReceptionCommand(
  session: SupabaseClient,
  service: () => SupabaseClient,
  input: unknown,
  expectedEventId?: string,
): Promise<ReceptionResult> {
  try {
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return { status: "forbidden" };
    const command = parseReceptionCommand(input);
    if (!command) return { status: "invalid_request" };
    const { data: event, error: eventError } = await session.from("events").select("id").eq("is_current",true).maybeSingle();
    if (eventError || !event) return { status: "unavailable" };
    if (expectedEventId !== undefined && event.id !== expectedEventId) return { status: "forbidden" };
    const { data: roles, error: rolesError } = await session.from("event_user_roles").select("role,event_id").eq("user_id",user.id);
    if (rolesError) return { status: "unavailable" };
    if (command.duty === "event_entry" && !roles?.some(row => (row.role === "admin" && row.event_id === null) ||
      (["manager","accoglienza"].includes(row.role) && row.event_id === event.id))) return { status: "forbidden" };
    if (command.duty !== "event_entry") {
      const { data: assignment, error: assignmentError } = await session.from("panel_reception_assignments")
        .select("id").eq("user_id", user.id).eq("event_id", event.id)
        .eq("panel_id", command.panelId!).eq("duty", command.duty).maybeSingle();
      if (assignmentError) return { status: "unavailable" };
      if (!assignment) return { status: "forbidden" };
    }
    const group = command.lookup.kind === "qr" && command.lookup.value.startsWith("G:");
    const { data, error } = group ? await service().rpc("reception_group_check_in", {
      p_event: event.id, p_actor: user.id, p_hash: hashQrToken(command.lookup.value.slice(2)),
      p_action: command.action, p_request: command.requestId ?? null,
      p_subjects: command.subjectIds ?? [], p_snapshot: command.groupSnapshot ?? null,
    }) : await service().rpc(command.duty === "event_entry" ? "reception_event_check_in" : "reception_panel_check_in", {
      ...(command.duty === "event_entry" ? {} : { p_panel_id: command.panelId }),
      p_duty: command.duty,
      p_event_id: event.id, p_actor_user_id: user.id,
      p_lookup_kind: command.lookup.kind,
      p_lookup: command.lookup.kind === "qr" ? hashQrToken(command.lookup.value) : command.lookup.value,
      p_action: command.action, p_request_id: command.requestId ?? null,
      p_subject_ids: command.subjectIds ?? [], p_students: command.students ?? null,
      p_companions: command.companions ?? null, p_expected_revision: command.expectedRevision ?? null,
      p_reason: command.reason ?? null,
    });
    if (error) return { status: error.code === "42501" ? "forbidden" : error.code === "22023" ? "invalid_request" : "unavailable" };
    const result = projectReceptionResult(data);
    if (result.status === "valid" && ((result.kind === "group") !== group)) return { status: "unavailable" };
    if (result.status === "valid" && command.duty !== "event_entry" &&
      (result.panel?.id !== command.panelId || (result.kind === "family" && result.persons.some(person => typeof person.eventCheckedIn !== "boolean")))) return { status: "unavailable" };
    if (result.status === "valid" && (command.duty === "room_assistance" ? result.kind !== "room" : result.kind === "room")) return { status: "unavailable" };
    return result;
  } catch {
    return { status: "unavailable" };
  }
}

// Explicit projection prevents new DB fields from accidentally crossing the
// server boundary. Unexpected/partial responses fail instead of inventing data.
export function projectReceptionResult(data: unknown): ReceptionResult {
  if (!data || typeof data !== "object") return { status: "unavailable" };
  const row = data as Record<string, unknown>;
  if (["invalid", "conflict", "not_booked", "event_entry_required", "capacity_exceeded", "panel_unavailable"].includes(String(row.status))) {
    return { status: row.status } as ReceptionResult;
  }
  let panel: { id: string; title: string; room: string; section: string } | undefined;
  if (row.panel !== undefined) {
    if (!row.panel || typeof row.panel !== "object") return { status: "unavailable" };
    const info = row.panel as Record<string, unknown>;
    if ([info.id, info.title, info.room, info.section].some(value => typeof value !== "string")) return { status: "unavailable" };
    panel = { id: info.id as string, title: info.title as string, room: info.room as string, section: info.section as string };
  }
  if (row.status !== "valid" || !Number.isSafeInteger(row.revision) || Number(row.revision)<0 ||
    !["verified","saved","unchanged","replayed"].includes(String(row.outcome)) ||
    !["submitted","confirmed"].includes(String(row.registrationStatus))) return { status: "unavailable" };
  const common = {
    ...(panel ? { panel } : {}),
    status: "valid" as const, revision: row.revision as number,
    outcome: row.outcome as "verified" | "saved" | "unchanged" | "replayed",
    registrationStatus: row.registrationStatus as "submitted" | "confirmed",
  };
  if (row.kind === "room" && panel && typeof row.label === "string") return { ...common, kind: "room", label: row.label, panel };
  const timestamp = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  if (row.kind === "group" && typeof row.groupId === "string" && typeof row.groupName === "string" &&
    typeof row.snapshot === "string" && /^[a-f0-9]{64}$/.test(row.snapshot) && Array.isArray(row.persons) && row.persons.length <= 10000 &&
    row.persons.every(p => p && typeof p.id === "string" && typeof p.registrationId === "string" && typeof p.code === "string" &&
      ["adult","child"].includes(p.kind) && typeof p.firstName === "string" && typeof p.lastName === "string" && timestamp(p.checkedInAt))) {
    return { ...common, kind: "group", groupId: row.groupId, groupName: row.groupName, snapshot: row.snapshot,
      persons: row.persons.map(p => ({ id:p.id, registrationId:p.registrationId, code:p.code, kind:p.kind,
        firstName:p.firstName, lastName:p.lastName, checkedInAt:p.checkedInAt })) };
  }
  if (row.kind === "family" && typeof row.code === "string" && Array.isArray(row.persons) && row.persons.length >= 1 && row.persons.length <= 11 &&
    row.persons.every(p => p && typeof p.id === "string" && ["adult","child"].includes(p.kind) &&
      typeof p.firstName === "string" && typeof p.lastName === "string" && timestamp(p.checkedInAt))) {
    return { ...common, kind: "family", code: row.code, persons: row.persons.map(p => ({
      id:p.id, kind:p.kind, firstName:p.firstName, lastName:p.lastName, checkedInAt:p.checkedInAt,
      ...(typeof p.eventCheckedIn === "boolean" ? { eventCheckedIn: p.eventCheckedIn } : {}),
    })) };
  }
  if (row.kind === "school" && typeof row.schoolName === "string" && typeof row.classDescription === "string" &&
    [row.expectedStudents,row.expectedCompanions,row.students,row.companions].every(n => Number.isSafeInteger(n) && Number(n)>=0) && timestamp(row.checkedInAt)) {
    return { ...common, kind: "school", schoolName:row.schoolName, classDescription:row.classDescription,
      expectedStudents:row.expectedStudents as number, expectedCompanions:row.expectedCompanions as number,
      students:row.students as number, companions:row.companions as number, checkedInAt:row.checkedInAt as string | null };
  }
  return { status: "unavailable" };
}
