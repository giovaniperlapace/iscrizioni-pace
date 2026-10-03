import test from "node:test";
import assert from "node:assert/strict";
import {batchFailure, retryAfterSeconds} from "../lib/email/batch-outcome.ts";
import {sendBroadcastBatch} from "../lib/email/smtp.ts";

test("classifies HTTP separately from provider codes and retries only definite rejection", () => {
  assert.equal(batchFailure(429).disposition, "retry");
  assert.equal(batchFailure(503,100).disposition, "retry");
  for (const status of [500,502,503,504]) assert.equal(batchFailure(status).disposition, "unknown");
  assert.equal(batchFailure(200,101).disposition, "unknown");
  assert.equal(batchFailure(401,10).disposition, "blocked");
  assert.equal(batchFailure(422,413).disposition, "blocked");
  assert.equal(batchFailure(413).disposition, undefined); // size, not account approval
  assert.equal(batchFailure(200,406).disposition, undefined); // inactive recipient
  assert.equal(retryAfterSeconds("120"),120);
  assert.equal(retryAfterSeconds("invalid"),undefined);
  assert.equal(retryAfterSeconds("Wed, 16 Sep 2026 12:02:00 GMT", Date.parse("2026-09-16T12:00:00Z")),120);
});

test("systemic failures stop split batches and leave never-submitted messages retryable", async () => {
  const oldFetch=globalThis.fetch, env={...process.env};
  try {
    process.env.EMAIL_DELIVERY_MODE="postmark";
    process.env.POSTMARK_SERVER_TOKEN="synthetic";
    const mail={to:"person@example.test",subject:"test",text:"test",html:"test"};
    for (const kind of ["rate-limit","maintenance","network","malformed","configuration"] as const) {
      let calls=0;
      globalThis.fetch=async()=>{
        calls++;
        if(kind==="network") throw Error("timeout after acceptance");
        if(kind==="malformed") return Response.json([]);
        if(kind==="configuration") return Response.json({ErrorCode:10},{status:401});
        if(kind==="maintenance") return Response.json({ErrorCode:100},{status:503});
        return new Response("rate limit",{status:429,headers:{"Retry-After":"240"}});
      };
      const results=await sendBroadcastBatch(Array.from({length:501},()=>mail));
      assert.equal(calls,1,kind);
      assert.equal(results[0].disposition,kind==="network"||kind==="malformed"?"unknown":kind==="configuration"?"blocked":"retry");
      assert.deepEqual(results[500],{errorCode:"postmark_batch_deferred",disposition:"retry"});
      if(kind==="rate-limit") assert.equal(results[0].retryAfterSeconds,240);
    }
    globalThis.fetch=async()=>Response.json([{ErrorCode:0,MessageID:"ok"},{ErrorCode:406},{ErrorCode:100}]);
    assert.deepEqual(await sendBroadcastBatch([mail,mail,mail]),[
      {messageId:"ok"},{errorCode:"postmark_406"},{errorCode:"postmark_100",disposition:"retry"},
    ]);
  } finally { globalThis.fetch=oldFetch; for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env); }
});
