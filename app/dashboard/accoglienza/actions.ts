"use server";

import { executeReceptionCommand } from "@/lib/reception/check-in.server";
import type { ReceptionResult } from "@/lib/reception/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// POST server action: QR never appears in a URL; the event duty is checked again in SQL.
export async function receptionCheckIn(expectedEventId: string, input: unknown): Promise<ReceptionResult> {
  return executeReceptionCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input, expectedEventId);
}

export async function groupBadgeCommand(input: unknown) {
  const { executeBadgeCommand } = await import("@/lib/reception/group-badges.server");
  return executeBadgeCommand(await createSupabaseServerClient(), createSupabaseServiceClient, input);
}
