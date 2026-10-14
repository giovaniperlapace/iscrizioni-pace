"use server";
import { executeLabelCommand } from "@/lib/reception/qr-labels.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
export async function qrLabelCommand(input: unknown) {
  return executeLabelCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input);
}
