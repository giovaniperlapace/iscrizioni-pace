"use server";

import { executeReceptionCommand } from "@/lib/reception/check-in.server";
import { executeLabelCommand } from "@/lib/reception/qr-labels.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function participantReceptionCommand(eventId: string, registrationId: string, input: unknown) {
  return executeReceptionCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input, eventId, registrationId);
}

export async function participantLabelCommand(registrationId: string, input: unknown) {
  return executeLabelCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input, registrationId);
}
