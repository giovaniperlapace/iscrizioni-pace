import type { SupabaseClient } from "@supabase/supabase-js";
import { distributionContext } from "./distribution.server.ts";
import {
  parsePairTicketCommand,
  type LeaderTickets,
} from "./leader-tickets.ts";
export async function loadLeaderTickets(
  db: SupabaseClient,
  service: () => SupabaseClient,
): Promise<LeaderTickets> {
  const context = await distributionContext(db, "leader");
  if (!context) throw Error("forbidden");
  const { data, error } = await service().rpc("get_ceremony_leader_tickets", {
    p_event: context.event.id,
    p_actor: context.userId,
  });
  if (
    error ||
    !data ||
    !["allocations", "nominees", "people", "tickets"].every((k) =>
      Array.isArray(data[k]),
    )
  )
    throw Error("unavailable");
  return data as LeaderTickets;
}
export async function executeLeaderPair(
  db: SupabaseClient,
  service: () => SupabaseClient,
  input: unknown,
) {
  const c = parsePairTicketCommand(input);
  if (!c) return { status: "invalid" };
  const context = await distributionContext(db, "leader");
  if (!context) return { status: "forbidden" };
  const { data, error } = await service().rpc("pair_ceremony_group_ticket", {
    p_event: context.event.id,
    p_actor: context.userId,
    p_allocation: c.allocationId,
    p_revision: c.revision,
    p_request: c.requestId,
    p_action: c.action,
    p_seat: c.seatId,
    p_registration: c.registrationId,
    p_child: c.childId,
    p_nominee: c.nomineeId,
  });
  if (error)
    return {
      status:
        error.code === "42501"
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
