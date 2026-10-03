"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function cancelOwnRegistration(registrationId: string, confirmed: boolean) {
  if (confirmed !== true || typeof registrationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
    return { error: "failed" } as const;
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "session" } as const;

  // The RPC locks and checks ownership/current event before any mutation.
  // Neither the actor nor the participant identity is accepted from the browser.
  const { error } = await createSupabaseServiceClient().rpc("cancel_own_registration", {
    p_registration_id: registrationId,
    p_actor_user_id: user.id,
  });
  if (error) return { error: "failed" } as const;
  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
