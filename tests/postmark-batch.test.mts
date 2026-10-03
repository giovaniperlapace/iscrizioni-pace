import assert from "node:assert/strict";
import test from "node:test";
import { sendBroadcastBatch } from "../lib/email/smtp.ts";

const mail = { to: "person@example.test", subject: "Test", text: "ciao", html: "<b>ciao</b>" };
test("batch preserves per-recipient results, count/byte bounds and never retries uncertain acceptance", async () => {
  const env = { ...process.env }, fetchBefore = globalThis.fetch;
  try {
    process.env.EMAIL_DELIVERY_MODE = "postmark";
    process.env.POSTMARK_SERVER_TOKEN = "synthetic";
    const requests: Array<Array<Record<string, unknown>>> = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.postmarkapp.com/email/batch");
      const batch = JSON.parse(String(init?.body)); requests.push(batch);
      assert.ok(Buffer.byteLength(String(init?.body)) <= 10_000_000);
      return Response.json(batch.map((_: unknown, i: number) => ({ ErrorCode: 0, MessageID: `id-${requests.length}-${i}` })));
    };
    const results = await sendBroadcastBatch(Array.from({length: 501}, () => mail));
    assert.deepEqual(requests.map(r => r.length), [500, 1]);
    assert.equal(results.length, 501); assert.equal(results[500].messageId, "id-2-0");
    assert.equal(requests[0][0].MessageStream, "broadcast");
    requests.length = 0;
    const large = { ...mail, attachments: [{filename:"qr.png", content:Buffer.alloc(4_000_000), contentType:"image/png", cid:"qr"}] };
    await sendBroadcastBatch([large, large]);
    assert.deepEqual(requests.map(r => r.length), [1, 1]);
    const attachments = requests[0][0].Attachments as Array<Record<string, unknown>>;
    assert.equal(attachments[0].ContentID, "cid:qr");
    globalThis.fetch = async () => Response.json([{ErrorCode:0,MessageID:"ok"},{ErrorCode:406,Message:"private@example.test"}]);
    assert.deepEqual(await sendBroadcastBatch([mail, {...mail,to:"bad,recipient"}, mail]), [
      {messageId:"ok"},{errorCode:"invalid_recipient"},{errorCode:"postmark_406"},
    ]);
    for (const data of [[], null, [{ErrorCode:0}]]) {
      globalThis.fetch = async () => Response.json(data);
      assert.deepEqual(await sendBroadcastBatch([mail]), [{errorCode:"postmark_response_unknown",disposition:"unknown"}]);
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("connection lost after acceptance"); };
    assert.deepEqual(await sendBroadcastBatch([mail,mail]), [{errorCode:"postmark_delivery_unknown",disposition:"unknown"},{errorCode:"postmark_delivery_unknown",disposition:"unknown"}]);
    assert.equal(calls,1);
    globalThis.fetch = async () => Response.json({ErrorCode:429,Message:"private"},{status:429});
    assert.deepEqual(await sendBroadcastBatch([mail]), [{errorCode:"postmark_429",disposition:"retry"}]);
  } finally {
    globalThis.fetch = fetchBefore;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
