"use server";

import { revalidatePath } from "next/cache";
import { formFailure } from "@/lib/forms/result";
import { requirePanelManager } from "@/lib/reception/assignments.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const path = "/dashboard/manager/panel-incarichi";
export async function savePanelReceptionAssignment(form: FormData) {
  const db = await createSupabaseServerClient();
  const manager = await requirePanelManager(db);
  if (!manager || form.get("eventId") !== manager.event.id) return formFailure([{ field: null, code: "forbidden" }]);
  const panelId = String(form.get("panelId") ?? "");
  const duty = String(form.get("duty") ?? "");
  const operation = form.get("operation");
  if (!uuid.test(panelId) || !["panel_entry", "room_assistance"].includes(duty) || !["assign", "revoke"].includes(String(operation))) {
    return formFailure([{ field: "panelId", code: "invalid" }]);
  }
  let userId = String(form.get("userId") ?? "");
  if (operation === "assign") {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return formFailure([{ field: "email", code: "email" }]);
    // Lookup is exact and management-authorized; never create accounts or send invitations here.
    const { data, error } = await createSupabaseServiceClient().from("profiles").select("id").eq("email", email).limit(2);
    if (error) return formFailure([{ field: null, code: "failed" }]);
    if (data?.length !== 1) return formFailure([{ field: "email", code: "invalid" }]);
    userId = data[0].id;
  }
  if (!uuid.test(userId)) return formFailure([{ field: null, code: "invalid" }]);
  if (operation === "revoke" && userId === manager.userId) return formFailure([{ field: null, code: "roleSelf" }]);
  const { error } = await db.rpc("set_panel_reception_assignment", {
    p_event_id: manager.event.id, p_panel_id: panelId, p_user_id: userId, p_duty: duty, p_assigned: operation === "assign",
  });
  if (error) return formFailure([{ field: null, code: error.code === "42501" ? "forbidden" : "failed" }]);
  revalidatePath(path);
  revalidatePath("/dashboard/accoglienza");
  return { redirect: `${path}?saved=${operation === "assign" ? "assigned" : "revoked"}` };
}
