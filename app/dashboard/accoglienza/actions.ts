"use server";

import { executeReceptionCommand } from "@/lib/reception/check-in.server";
import type { ReceptionResult } from "@/lib/reception/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// POST server action: QR never appears in a URL. P12 will supply the scanner UI.
export async function receptionCheckIn(input: unknown): Promise<ReceptionResult> {
  return executeReceptionCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input);
}
