"use server";

import { isReceptionOperator } from "@/lib/reception/access.server";
import { executeReceptionCommand } from "@/lib/reception/check-in.server";
import type { ReceptionResult } from "@/lib/reception/contracts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// POST server action: QR never appears in a URL; the event duty is checked again in SQL.
export async function receptionCheckIn(expectedEventId: string, input: unknown): Promise<ReceptionResult> {
  const session = await createSupabaseServerClient();
  if (!await isReceptionOperator(session)) return { status: "forbidden" };
  return executeReceptionCommand(session, createSupabaseServiceClient, input, expectedEventId);
}

export async function groupBadgeCommand(input: unknown) {
  const session = await createSupabaseServerClient();
  if (!await isReceptionOperator(session)) return { status: "forbidden" } as const;
  const { executeBadgeCommand } = await import("@/lib/reception/group-badges.server");
  return executeBadgeCommand(session, createSupabaseServiceClient, input);
}
