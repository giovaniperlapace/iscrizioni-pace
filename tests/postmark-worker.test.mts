import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";

function harness(failSave = false, exhaustBudget = false, recovery?: { results: object[]; pauseFails?: boolean }) {
  const states = new Map<string, string>();
  let claims = 0, batchCalls = 0;
  const pauses: unknown[] = [];
  const campaignStatuses: string[] = [];
  const exports: Record<string, unknown> = {};
  const service = {
    async rpc(name: string, args: unknown) {
      if (name === "pause_email_campaign_delivery") { pauses.push(args); return { error: recovery?.pauseFails ? {message:"pause unavailable"} : null }; }
      claims++;
      if (exhaustBudget) now += 200_000;
      return { data: claims <= 2 ? [0,1].map(i => ({ id:`${claims}-${i}`, campaign_id:"campaign",recipient_type:"group_leader",recipient_user_id:`${claims}-${i}`})) : [] };
    },
    from(table: string) {
      let update: {status?:string} | undefined, id = "", statusFilter = "";
      const q = {
        select() { return q; }, in() {return q;}, order(){return q;}, insert(){return q;},
        update(value: {status:string}) {update=value;return q;},
        eq(key: string,value:string){if(key==="id")id=value;if(key==="status")statusFilter=value;return q;},
        async maybeSingle(){return {data:{status:"completed"}};},
        then(resolve: (value: unknown) => unknown) {
          if (update && table === "email_campaign_recipients") {
            if (failSave && id.endsWith("-0")) return Promise.resolve({error:{message:"db down"}}).then(resolve);
            states.set(id, update.status!);
          }
          if (update && table === "email_campaigns") campaignStatuses.push(update.status!);
          const data = table === "email_campaigns" && !update
            ? [{id:"campaign",event_id:"event",subject_template:"test",body_template:"hello",events:{title:"event"}}] : [];
          return Promise.resolve({data,count: statusFilter ? [...states.values()].filter(value=>value===statusFilter).length : 0,error:null}).then(resolve);
        },
      };
      return q;
    },
  };
  let now = 0;
  const source = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-delivery.server.ts",import.meta.url),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","exports","Date",source)((id:string) => {
    if(id==="node:crypto")return {createHash};
    if(id.includes("config")) return {getEmailConfig:()=>({})};
    if(id.includes("supabase/service"))return {createSupabaseServiceClient:()=>service};
    if(id.includes("campaign-scheduling"))return {getCampaignLocalDate:()=>"2026-09-15"};
    if(id.includes("campaign-eligibility"))return {isCampaignRecipientOperational:async()=>true,RegistrationNotOperationalError:class extends Error{}};
    if(id.includes("campaign-html"))return {renderSafeCampaignHtml:()=>"hello",campaignHtmlToText:()=>"hello"};
    if(id.includes("campaign-templates"))return {renderCampaignTemplate:()=>"test"};
    if(id.includes("operational-users"))return {splitFullName:()=>({firstName:"A",lastName:"B"}),getOperationalUserIdentities:async(_:unknown,ids:string[])=>new Map([[ids[0],{email:"test@example.test",fullName:"A B"}]])};
    if(id.includes("smtp"))return {EmailDeliveryError:class extends Error{},sendBroadcastBatch:async(inputs:unknown[])=>{batchCalls++;assert.equal(inputs.length,2);return recovery?.results ?? inputs.map((_,i)=>i===1&&!failSave?{errorCode:"postmark_406"}:{messageId:`id-${i}`});}};
    return {};
  },exports,class extends Date {static now(){return now;}});
  return {run:exports.processDueCampaignDeliveries as (options:object)=>Promise<{sent:number;failed:number}>,states,pauses,campaignStatuses,counts:()=>({claims,batchCalls})};
}
test("worker drains successive claims immediately and records individual batch outcomes",async()=>{
  const h=harness();const result=await h.run({campaignId:"campaign"});
  assert.equal(result.sent,2);assert.equal(result.failed,2);
  assert.deepEqual(h.counts(),{claims:3,batchCalls:2});
  assert.deepEqual([...h.states.values()],["sent","failed","sent","failed"]);
});
test("worker persists other accepted messages after a DB failure and stops claiming",async()=>{
  const h=harness(true);await assert.rejects(h.run({}),/db down/);
  assert.equal(h.states.get("1-1"),"sent");assert.equal(h.states.has("1-0"),false);
  assert.deepEqual(h.counts(),{claims:1,batchCalls:1});
});
test("worker completes current claim then leaves remaining work when budget expires",async()=>{
  const h=harness(false,true);await h.run({});
  assert.deepEqual(h.counts(),{claims:1,batchCalls:1});
});

test("worker defers rate-limited recipients and stops claiming more blocks", async () => {
  const h = harness(false, false, { results: [
    {errorCode:"postmark_429",disposition:"retry",retryAfterSeconds:180},
    {errorCode:"postmark_batch_deferred",disposition:"retry"},
  ] });
  const result = await h.run({});
  assert.equal(result.failed, 0);
  assert.deepEqual([...h.states.values()], ["scheduled", "scheduled"]);
  assert.deepEqual(h.counts(), {claims:1,batchCalls:1});
  assert.deepEqual(h.pauses, [{p_error_code:"postmark_429",p_blocked:false,p_retry_after_seconds:180}]);
});

test("mixed batch preserves success, isolates unknown acceptance and does not retry", async () => {
  const h = harness(false, false, {results:[{messageId:"accepted"},{errorCode:"postmark_delivery_unknown",disposition:"unknown"}]});
  const result = await h.run({});
  assert.equal(result.sent, 1); assert.equal(result.failed, 0);
  assert.deepEqual([...h.states.values()], ["sent", "unknown"]);
  assert.deepEqual(h.campaignStatuses,["attention"]);
  assert.deepEqual(h.counts(), {claims:1,batchCalls:1});
});

test("configuration rejection blocks the shared queue without failing recipients", async () => {
  const h = harness(false, false, {results:[{errorCode:"postmark_10",disposition:"blocked"},{errorCode:"postmark_10",disposition:"blocked"}]});
  await h.run({});
  assert.deepEqual([...h.states.values()], ["scheduled", "scheduled"]);
  assert.deepEqual(h.pauses, [{p_error_code:"postmark_10",p_blocked:true,p_retry_after_seconds:60}]);
});

test("failure to persist the shared pause preserves successes and never releases retry rows", async () => {
  const h = harness(false, false, {pauseFails:true,results:[{messageId:"accepted"},{errorCode:"postmark_429",disposition:"retry"}]});
  await assert.rejects(h.run({}), /pause unavailable/);
  assert.equal(h.states.get("1-0"), "sent");
  assert.equal(h.states.has("1-1"), false);
  assert.deepEqual(h.counts(), {claims:1,batchCalls:1});
});
