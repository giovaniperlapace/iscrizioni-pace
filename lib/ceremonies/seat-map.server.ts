import type { SupabaseClient } from "@supabase/supabase-js";
import { distributionContext } from "./distribution.server.ts";
import {
  isMapId,
  validMapSeats,
  parseSeatMapCommand,
  type SeatMapView,
} from "./seat-map.ts";
export async function loadSeatMap(
  db: SupabaseClient,
  service: () => SupabaseClient,
  mode: "leader" | "manager",
  planId: string,
): Promise<SeatMapView> {
  const context = await distributionContext(db, mode);
  if (!context || !isMapId(planId)) throw Error("forbidden");
  const { data, error } = await service().rpc("get_ceremony_map", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_plan: planId,
    p_mode: mode,
  });
  if (
    error ||
    !data ||
    !Number.isInteger(data.revision) ||
    data.planId !== planId ||
    !["opening", "closing"].includes(data.kind) ||
    !["draft", "validated"].includes(data.state) ||
    ![data.active, data.draft].every(
      (v) =>
        v === null ||
        (v &&
          isMapId(v.id) &&
          Number.isInteger(v.version) &&
          typeof v.title === "string" &&
          validMapSeats(v.seats)),
    ) ||
    !["sectors", "allocations", "nominees", "claims", "history"].every((k) =>
      Array.isArray(data[k]),
    )
  )
    throw Error("unavailable");
  return data as SeatMapView;
}
export async function executeSeatMap(
  db: SupabaseClient,
  service: () => SupabaseClient,
  mode: "leader" | "manager",
  input: unknown,
) {
  const c = parseSeatMapCommand(input);
  if (!c) return { status: "invalid" };
  const context = await distributionContext(db, mode);
  if (
    !context?.canManage ||
    (mode === "leader" && !["name", "unname"].includes(c.operation)) ||
    (["draft", "publish"].includes(c.operation) &&
      !("admin" in context && context.admin))
  )
    return { status: "forbidden" };
  const { data, error } = await service().rpc("set_ceremony_map", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_plan: c.planId,
    p_revision: c.revision,
    p_request: c.requestId,
    p_operation: c.operation,
    p_data: c.data,
  });
  if (error)
    return {
      status:
        error.code === "42501"
          ? "forbidden"
          : error.code === "P1303"
            ? "seats_active"
            : error.code === "P1304"
              ? "capacity"
              : error.code === "23505"
                ? "occupied"
                : ["22023", "22P02", "23514", "23502"].includes(error.code)
                  ? "invalid"
                  : "unavailable",
    };
  return {
    status: typeof data?.status === "string" ? data.status : "unavailable",
  };
}
