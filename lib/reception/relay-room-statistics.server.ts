import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRelayRoomStatistics } from "./relay-room-statistics.ts";
// Call only after main-duty authorization; the RPC also rechecks actor/event/duty.
export async function loadRelayRoomStatistics(db: SupabaseClient, eventId: string, actorId: string, panelId: string) {
  try {
    const {data,error} = await db.rpc("reception_relay_room_statistics", {p_event:eventId,p_actor:actorId,p_panel:panelId});
    const rooms = error ? null : parseRelayRoomStatistics(data);
    if (!rooms) return null;
    return await Promise.all(rooms.map(async room => {
      try {
        // Reuse the canonical reservation counter, including selected minors and schools.
        const {data:stats,error:statsError} = await db.rpc("reception_target_statistics", {p_event:eventId,p_actor:actorId,p_target:room.panelId});
        if (!statsError && Number.isSafeInteger(stats?.booked) && stats.booked >= 0 && Number.isSafeInteger(stats?.entered) && stats.entered >= 0)
          return {...room,entered:stats.entered,booked:stats.booked};
      } catch { /* Keep known capacity/entries; an unavailable reservation count is never zero. */ }
      return {...room,booked:null};
    }));
  } catch { return null; }
}
