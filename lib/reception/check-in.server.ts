import type { SupabaseClient } from "@supabase/supabase-js";
import { hashQrToken } from "../qrcode/token.ts";
import { parseReceptionCommand, type ReceptionResult } from "./contracts.ts";

// No log of the command, token, RPC error/detail or returned identities.
// The injected service client is created only after session verification.
export async function executeReceptionCommand(
  session: SupabaseClient,
  service: () => SupabaseClient,
  input: unknown,
): Promise<ReceptionResult> {
  try {
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return { status: "forbidden" };
    const command = parseReceptionCommand(input);
    if (!command) return { status: "invalid_request" };
    const { data: event, error: eventError } = await session.from("events").select("id").eq("is_current",true).maybeSingle();
    if (eventError || !event) return { status: "unavailable" };
    const { data: roles, error: rolesError } = await session.from("event_user_roles").select("role,event_id").eq("user_id",user.id);
    if (rolesError) return { status: "unavailable" };
    if (!roles?.some(row => (row.role === "admin" && row.event_id === null) ||
      (["manager","accoglienza"].includes(row.role) && row.event_id === event.id))) return { status: "forbidden" };
    const { data, error } = await service().rpc("reception_check_in", {
      p_event_id: event.id, p_actor_user_id: user.id,
      p_lookup_kind: command.lookup.kind,
      p_lookup: command.lookup.kind === "qr" ? hashQrToken(command.lookup.value) : command.lookup.value,
      p_action: command.action, p_request_id: command.requestId ?? null,
      p_subject_ids: command.subjectIds ?? [], p_students: command.students ?? null,
      p_companions: command.companions ?? null, p_expected_revision: command.expectedRevision ?? null,
      p_reason: command.reason ?? null,
    });
    if (error) return { status: error.code === "42501" ? "forbidden" : error.code === "22023" ? "invalid_request" : "unavailable" };
    return projectReceptionResult(data);
  } catch {
    return { status: "unavailable" };
  }
}

// Explicit projection prevents new DB fields from accidentally crossing the
// server boundary. Unexpected/partial responses fail instead of inventing data.
export function projectReceptionResult(data: unknown): ReceptionResult {
  if (!data || typeof data !== "object") return { status: "unavailable" };
  const row = data as Record<string, unknown>;
  if (row.status === "invalid" || row.status === "conflict") return { status: row.status };
  if (row.status !== "valid" || !Number.isSafeInteger(row.revision) || Number(row.revision)<0 ||
    !["verified","saved","unchanged","replayed"].includes(String(row.outcome)) ||
    !["submitted","confirmed"].includes(String(row.registrationStatus))) return { status: "unavailable" };
  const common = {
    status: "valid" as const, revision: row.revision as number,
    outcome: row.outcome as "verified" | "saved" | "unchanged" | "replayed",
    registrationStatus: row.registrationStatus as "submitted" | "confirmed",
  };
  const timestamp = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  if (row.kind === "family" && typeof row.code === "string" && Array.isArray(row.persons) && row.persons.length >= 1 && row.persons.length <= 11 &&
    row.persons.every(p => p && typeof p.id === "string" && ["adult","child"].includes(p.kind) &&
      typeof p.firstName === "string" && typeof p.lastName === "string" && timestamp(p.checkedInAt))) {
    return { ...common, kind: "family", code: row.code, persons: row.persons.map(p => ({
      id:p.id, kind:p.kind, firstName:p.firstName, lastName:p.lastName, checkedInAt:p.checkedInAt,
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
