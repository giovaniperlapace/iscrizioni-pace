import assert from "node:assert/strict";
import test from "node:test";
import { getEmailConfig } from "../lib/email/config.ts";
import { sendTransactionalEmail, sendBroadcastEmail } from "../lib/email/smtp.ts";

const mail = { to: "person@example.test", subject: "Test", text: "secret magic link", html: '<img src="cid:qr">', attachments: [{ filename: "qr.png", content: Buffer.from("test"), contentType: "image/png", cid: "qr" }] };

test("Postmark transport: streams, identity, attachments, errors and no duplicate retry", async () => {
  const before = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.EMAIL_DELIVERY_MODE = "postmark";
    process.env.POSTMARK_SERVER_TOKEN = "test-secret";
    delete process.env.EMAIL_FROM; delete process.env.EMAIL_REPLY_TO;
    delete process.env.POSTMARK_TRANSACTIONAL_STREAM; delete process.env.POSTMARK_BROADCAST_STREAM;
    const requests: Record<string, unknown>[] = [];
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.postmarkapp.com/email");
      assert.equal(init?.redirect, "error");
      assert.equal((init?.headers as Record<string,string>)["X-Postmark-Server-Token"], "test-secret");
      requests.push(JSON.parse(init?.body as string));
      return Response.json({ ErrorCode: 0, MessageID: "accepted-id" });
    };
    assert.equal((await sendTransactionalEmail(mail)).messageId, "accepted-id");
    await sendBroadcastEmail(mail);
    assert.deepEqual(requests.map(r => r.MessageStream), ["outbound", "broadcast"]);
    for (const r of requests) {
      assert.equal(r.From, "registrationspeace@santegidio.org");
      assert.equal(r.ReplyTo, r.From);
      assert.equal(r.TrackLinks, "None"); assert.equal(r.TrackOpens, false);
      assert.deepEqual(r.Attachments, [{ Name: "qr.png", Content: "dGVzdA==", ContentType: "image/png", ContentID: "cid:qr" }]);
    }
    await assert.rejects(sendTransactionalEmail({ ...mail, to: "a@example.test,b@example.test" }), /invalid_recipient/);
    for (const response of [Response.json({ ErrorCode: 406, Message: "private@email.test" }, {status:422}), Response.json({ ErrorCode: 0 }), new Response("bad gateway", {status:502})]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return response; };
      await assert.rejects(sendBroadcastEmail(mail), error => { assert.doesNotMatch(String(error), /private@email/); return true; });
      assert.equal(calls, 1);
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("network secret"); };
    await assert.rejects(sendTransactionalEmail(mail), /postmark_delivery_unknown/);
    assert.equal(calls, 1);
    process.env.EMAIL_DELIVERY_MODE = "log";
    const originalLog = console.info; const logs: unknown[] = [];
    try {
      console.info = (...args) => { logs.push(args); };
      assert.match((await sendTransactionalEmail(mail)).messageId, /^log-/);
      assert.doesNotMatch(JSON.stringify(logs), /secret|person@example|qr.png/);
      assert.equal(calls, 1);
    } finally { console.info = originalLog; }
    process.env.EMAIL_DELIVERY_MODE = "smtp";
    assert.throws(getEmailConfig, /must be postmark/);
    process.env.EMAIL_DELIVERY_MODE = "postmark";
    delete process.env.POSTMARK_SERVER_TOKEN;
    assert.throws(getEmailConfig, /Missing POSTMARK/);
    process.env.POSTMARK_SERVER_TOKEN = "POSTMARK_API_TEST";
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.throws(getEmailConfig, /not allowed in production/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
