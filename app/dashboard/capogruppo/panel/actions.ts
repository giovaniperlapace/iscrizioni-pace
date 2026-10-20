"use server";
import { validForumChildIds } from "@/lib/panels/child-selection";
import { requirePublicPanelBookings } from "@/lib/panels/release.server";

import { getRequestLocale } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { groupBookingError, validGroupBookingSelection, type GroupBookingResult, type GroupWaitlistIntent } from "@/lib/panels/group-bookings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setGroupPanelBooking(sectionId: string, registrationId: string, booked: boolean, childIds: string[] = []): Promise<GroupBookingResult> {
  await requirePublicPanelBookings();
  if (!validForumChildIds(childIds) || !validGroupBookingSelection(sectionId, [registrationId]) || typeof booked !== "boolean") return {error: "failure"};
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") return {error: "scopeError"};
  const eventId = await getCurrentOperationalEventId(db);
  if (!eventId) return {error: "scopeError"};
  const {data, error} = await db.rpc("set_panel_family_booking", {
    p_panel_id: null, p_section_id: sectionId, p_registration_id: registrationId,
    p_intent: booked ? "book" : "cancel", p_child_ids: childIds, p_as_leader: true,
  });
  if (error) {
    console.error("[group-panel:book]", error.code, error.message);
    return groupBookingError(error);
  }
  for (const path of ["/", "/dashboard/capogruppo/panel", "/dashboard/partecipante", "/dashboard/admin", "/dashboard/manager", "/dashboard/manager/email"]) revalidatePath(path);
  return data as {count: number; seats: number};
}

export async function setGroupPanelWaitlist(sectionId: string, registrationId: string, intent: GroupWaitlistIntent, childIds: string[] = []): Promise<GroupBookingResult> {
  await requirePublicPanelBookings();
  if (!validForumChildIds(childIds) || !validGroupBookingSelection(sectionId, [registrationId]) || !["join", "leave", "accept"].includes(intent)) return { error: "failure" };
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db, "capogruppo");
  if (!auth || auth.dashboardRole !== "capogruppo") return { error: "scopeError" };
  const eventId = await getCurrentOperationalEventId(db);
  if (!eventId) return { error: "scopeError" };
  const { data, error } = await db.rpc("set_panel_family_booking", {
    p_panel_id: null, p_section_id: sectionId, p_registration_id: registrationId,
    p_intent: intent, p_locale: await getRequestLocale(), p_child_ids: childIds, p_as_leader: true,
  });
  if (error) {
    console.error("[group-panel:waitlist]", error.code, error.message);
    return groupBookingError(error);
  }
  for (const path of ["/", "/dashboard/capogruppo/panel", "/dashboard/partecipante", "/dashboard/admin", "/dashboard/manager"]) revalidatePath(path);
  if (data?.status === "expired") return { error: "expired" };
  if (data?.status === "available") return { error: "availableNow" };
  if (!["queued", "left", "booked"].includes(data?.status)) return { error: "failure" };
  return data as GroupBookingResult;
}
