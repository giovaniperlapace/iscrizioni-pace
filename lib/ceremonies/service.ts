import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCeremonyForm,
  type CeremonyKind,
  type CeremonySnapshot,
  type CeremonyResult,
} from "./contracts.ts";

export async function ceremonyContext(db: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) return null;
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id,title")
    .eq("is_current", true)
    .maybeSingle();
  if (eventError || !event) return null;
  const { data: roles, error } = await db
    .from("event_user_roles")
    .select("role,event_id")
    .eq("user_id", user.id);
  if (error || !roles) return null;
  const admin = roles.some((r) => r.role === "admin" && r.event_id === null);
  const manager = roles.some(
    (r) => r.role === "manager" && r.event_id === event.id,
  );
  if (
    !admin &&
    !manager &&
    !roles.some((r) => r.role === "manager_viewer" && r.event_id === event.id)
  )
    return null;
  return {
    userId: user.id,
    event,
    admin,
    canManage: admin || manager,
    dashboard: admin ? ("admin" as const) : ("manager" as const),
  };
}
export async function loadCeremony(
  service: SupabaseClient,
  context: NonNullable<Awaited<ReturnType<typeof ceremonyContext>>>,
  kind: CeremonyKind,
): Promise<CeremonySnapshot> {
  const { data, error } = await service.rpc("get_ceremony", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_kind: kind,
  });
  if (
    error ||
    !data ||
    !["sectors", "quotas", "allocations", "people", "groups"].every((k) =>
      Array.isArray(data[k]),
    ) ||
    !(data.plan === null || Number.isInteger(data.plan?.revision))
  )
    throw new Error(
      "Impossibile caricare la configurazione completa delle cerimonie.",
    );
  return data as CeremonySnapshot;
}
export async function executeCeremony(
  session: SupabaseClient,
  service: () => SupabaseClient,
  form: FormData,
): Promise<CeremonyResult> {
  const command = parseCeremonyForm(form);
  if (!command) return { status: "invalid" };
  const context = await ceremonyContext(session);
  if (
    !context?.canManage ||
    (["configure", "sector"].includes(command.operation) && !context.admin)
  )
    return { status: "forbidden" };
  const { data, error } = await service().rpc("save_ceremony", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_kind: command.kind,
    p_revision: command.revision,
    p_operation: command.operation,
    p_data: command.data,
  });
  if (error)
    return {
      status:
        error.code === "P1303"
          ? "seats_active"
          : error.code === "P1304"
            ? "capacity"
            : error.code === "P1302"
          ? "nominees_active"
          : error.code === "42501"
            ? "forbidden"
            : error.code === "23505"
              ? "duplicate"
              : ["22023", "22P02", "22007", "22008", "23514", "23502"].includes(
                    error.code,
                  )
                ? "invalid"
                : "unavailable",
    };
  return {
    status: typeof data?.status === "string" ? data.status : "unavailable",
  };
}
