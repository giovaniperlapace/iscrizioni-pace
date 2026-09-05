"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formFailure, formFailureFromRedirect } from "@/lib/forms/result";
import { optionalUuid } from "@/lib/registrations/validation";

export async function updateRegistrationDelivery(formData: FormData) {
  const registrationId = optionalUuid(formData.get("registrationId"));
  const assignmentId = optionalUuid(formData.get("assignmentId"));
  const mode = formData.get("deliveryMode");
  if (!registrationId || !assignmentId || (mode !== "personal" && mode !== "delegated")) return formFailure([{ field: "deliveryMode", code: "invalid" }]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_registration_delivery", { target_registration_id: registrationId, delivery_mode: mode });
  if (error?.message === "personal-email-required" || error?.message === "delegate-email-required") {
    return formFailure([{ field: "deliveryMode", code: error.message === "personal-email-required" ? "personalEmailRequired" : "delegateEmailRequired" }]);
  }
  if (error) return formFailureFromRedirect(`/dashboard/capogruppo?error=${encodeURIComponent(error.code === "42501" ? "forbidden" : error.message)}`);
  revalidatePath("/dashboard/capogruppo");
  revalidatePath("/dashboard/manager/email");
  redirect(`/dashboard/capogruppo?assignmentId=${assignmentId}&saved=delivery`);
}
