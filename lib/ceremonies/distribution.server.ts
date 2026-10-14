import type { SupabaseClient } from "@supabase/supabase-js";
import { ceremonyContext } from "./service.ts";
import {
  parseNomineeCommand,
  type DistributionView,
  type PersonalSeat,
} from "./distribution.ts";
export async function distributionContext(
  db: SupabaseClient,
  mode: "leader" | "manager" | "personal",
) {
  if (mode === "manager") return ceremonyContext(db);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id,title")
    .eq("is_current", true)
    .maybeSingle();
  if (eventError || !event) return null;
  if (mode === "leader") {
    const { data, error } = await db
      .from("group_memberships")
      .select("group_id,groups!inner(event_id,is_active)")
      .eq("user_id", user.id)
      .eq("role", "capogruppo")
      .eq("groups.event_id", event.id)
      .eq("groups.is_active", true)
      .limit(1);
    if (error || !data?.length) return null;
  }
  return { userId: user.id, event, canManage: mode === "leader" };
}
export async function loadDistribution(
  db: SupabaseClient,
  service: () => SupabaseClient,
  mode: "leader" | "manager",
): Promise<DistributionView> {
  const context = await distributionContext(db, mode);
  if (!context) throw Error("forbidden");
  const { data, error } = await service().rpc("get_ceremony_distribution", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_mode: mode,
  });
  if (
    error ||
    !data ||
    !["allocations", "nominees", "people"].every((k) => Array.isArray(data[k]))
  )
    throw Error("unavailable");
  return data as DistributionView;
}
export async function loadPersonalSeats(
  db: SupabaseClient,
  service: () => SupabaseClient,
): Promise<PersonalSeat[]> {
  const context = await distributionContext(db, "personal");
  if (!context) throw Error("forbidden");
  const { data, error } = await service().rpc("get_my_ceremony_seats", {
    p_event: context.event.id,
    p_actor: context.userId,
  });
  if (error || !Array.isArray(data)) throw Error("unavailable");
  return data as PersonalSeat[];
}
export async function executeNominee(
  db: SupabaseClient,
  service: () => SupabaseClient,
  mode: "leader" | "manager",
  input: unknown,
) {
  const c = parseNomineeCommand(input);
  if (!c) return { status: "invalid" };
  const context = await distributionContext(db, mode);
  if (!context?.canManage) return { status: "forbidden" };
  const { data, error } = await service().rpc("set_ceremony_nominee", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_action: c.action,
    p_allocation: c.allocationId,
    p_registration: c.registrationId,
    p_child: c.childId,
    p_nominee: c.nomineeId,
    p_revision: c.revision,
    p_request: c.requestId,
  });
  if (error)
    return {
      status:
        error.code === "P1303"
          ? "seats_active"
          : error.code === "42501"
          ? "forbidden"
          : error.code === "23505"
            ? "duplicate"
            : ["22023", "22P02", "23514"].includes(error.code)
              ? "invalid"
              : "unavailable",
    };
  return {
    status: typeof data?.status === "string" ? data.status : "unavailable",
  };
}
