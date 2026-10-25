import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRelayRoomStatistics } from "./relay-room-statistics.ts";
// Call only after main-duty authorization; the RPC also rechecks actor/event/duty.
export async function loadRelayRoomStatistics(db: SupabaseClient, eventId: string, actorId: string, panelId: string) {
  try {
    const {data,error} = await db.rpc("reception_relay_room_statistics", {p_event:eventId,p_actor:actorId,p_panel:panelId});
    return error ? null : parseRelayRoomStatistics(data);
  } catch { return null; }
}
