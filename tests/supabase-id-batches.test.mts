import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadRowsForIds } from "../lib/supabase/all-rows.ts";

const ids = Array.from({ length: 601 }, (_, i) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

test("UUID batches fit the proxy and preserve all relations across pages and duplicate IDs", async () => {
  const lengths: number[] = [];
  const client = createClient("https://database.example.test", "test-key", {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        const length = (url.pathname + url.search).length;
        lengths.push(length);
        if (length > 8192) return new Response("URI too long", { status: 414 });
        const batch = url.searchParams.get("participant_id")!.slice(4, -1).split(",");
        const from = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 500);
        const rows = batch.flatMap((id) => Array.from({ length: 6 }, (_, tag) => ({ id, tag })));
        return Response.json(rows.slice(from, from + limit));
      },
    },
  });
  const { data } = await loadRowsForIds([...ids, ...ids.slice(0, 5)], (batch, from, to) =>
    client.from("participant_operational_tags")
      .select("participant_id,assigned_at,operational_tags!inner(id,event_id,label,color)")
      .eq("operational_tags.event_id", "00000000-0000-4000-8000-000000000999")
      .in("participant_id", batch).order("participant_id").order("tag_id").range(from, to),
  );
  assert.deepEqual(data, ids.flatMap((id) => Array.from({ length: 6 }, (_, tag) => ({ id, tag }))));
  assert.ok(lengths.every((length) => length < 8192));
  assert.ok(lengths.length > Math.ceil(ids.length / 100), "must also page within a batch");
});

test("a later batch error rejects the whole read instead of returning partial data", async () => {
  let calls = 0;
  await assert.rejects(loadRowsForIds(ids, async (batch) => {
    calls++;
    return calls === 2
      ? { data: null, error: { message: "database unavailable" } }
      : { data: batch, error: null };
  }), /database unavailable/);
  assert.equal(calls, 2);
});
