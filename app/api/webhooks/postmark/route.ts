import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizePostmarkEvent } from "@/lib/email/campaign-report";
import { getEmailConfig } from "@/lib/email/config";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
export async function POST(request: Request) {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  const actual = Buffer.from(request.headers.get("x-postmark-secret") ?? "");
  const expected = Buffer.from(secret ?? "");
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Bound streamed bodies too; do not trust Content-Length.
  const reader = request.body?.getReader();
  let text = "";
  let bytes = 0;
  if (!reader)
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 65536) {
      await reader.cancel();
      return NextResponse.json({ error: "Too large" }, { status: 413 });
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  let event;
  try {
    event = normalizePostmarkEvent(
      JSON.parse(text),
      getEmailConfig().broadcastStream,
    );
  } catch (cause) {
    const reason = cause instanceof Error && ["wrong_stream", "unsupported_event", "invalid_recipient", "invalid_date", "invalid_message", "invalid_suppression"].includes(cause.message) ? cause.message : "invalid_json";
    // Postmark verification probes may name a different stream. Authenticated
    // out-of-scope events are acknowledged without persisting any evidence.
    if (reason === "wrong_stream") return NextResponse.json({ ok: true, ignored: true });
    return NextResponse.json({ error: "Invalid event", reason }, { status: 400 });
  }
  const { error } = await createSupabaseServiceClient().rpc(
    "record_campaign_delivery_event",
    { p_event: event },
  );
  // Acknowledge only durable persistence. A transient DB outage must be retried.
  if (error)
    return NextResponse.json(
      { error: "Persistence unavailable" },
      { status: 503 },
    );
  return NextResponse.json({ ok: true });
}
