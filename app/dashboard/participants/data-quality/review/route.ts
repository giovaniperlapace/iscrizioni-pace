import { NextRequest, NextResponse } from "next/server";
import { qualityAccess } from "@/lib/data-quality/access.server";
import { parseDuplicatePair } from "@/lib/data-quality/review";
import { loadDuplicateReview } from "@/lib/data-quality/review.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const { db, auth, event, canWrite } = await qualityAccess();
    const ids = parseDuplicatePair(request.nextUrl.searchParams.get("pair"));
    if (!ids) throw new Error("Scegli due iscrizioni da confrontare.");
    const result = await loadDuplicateReview(db, createSupabaseServiceClient(), event.id, auth.user.id, ids, canWrite);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Confronto non disponibile." }, { status: 400, headers });
  }
}
