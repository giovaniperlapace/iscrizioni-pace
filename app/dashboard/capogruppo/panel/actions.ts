"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { groupBookingError, validGroupBookingSelection, type GroupBookingResult } from "@/lib/panels/group-bookings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setGroupPanelBooking(sectionId: string, registrationId: string, booked: boolean): Promise<GroupBookingResult> {
  if (!validGroupBookingSelection(sectionId, [registrationId]) || typeof booked !== "boolean") return {error: "failure"};
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") return {error: "scopeError"};
  const eventId = await getCurrentOperationalEventId(db);
  if (!eventId) return {error: "scopeError"};
  const {data, error} = await db.rpc("set_group_panel_booking", {
    p_event_id: eventId, p_section_id: sectionId, p_registration_id: registrationId, p_booked: booked,
  });
  if (error) {
    console.error("[group-panel:book]", error.code, error.message);
    return groupBookingError(error);
  }
  for (const path of ["/", "/dashboard/capogruppo/panel", "/dashboard/partecipante", "/dashboard/admin", "/dashboard/manager", "/dashboard/manager/email"]) revalidatePath(path);
  return data as {count: number; seats: number};
}
