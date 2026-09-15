import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createHash } from "node:crypto";

function harness(failSave = false, exhaustBudget = false) {
  const states = new Map<string, string>();
  let claims = 0, batchCalls = 0;
  const exports: Record<string, unknown> = {};
  const service = {
    async rpc() {
      claims++;
      if (exhaustBudget) now += 200_000;
      return { data: claims <= 2 ? [0,1].map(i => ({ id:`${claims}-${i}`, campaign_id:"campaign",recipient_type:"group_leader",recipient_user_id:`${claims}-${i}`})) : [] };
    },
    from(table: string) {
      let update: {status?:string} | undefined, id = "";
      const q = {
        select() { return q; }, in() {return q;}, order(){return q;}, insert(){return q;},
        update(value: {status:string}) {update=value;return q;},
        eq(key: string,value:string){if(key==="id")id=value;return q;},
        async maybeSingle(){return {data:{status:"completed"}};},
        then(resolve: (value: unknown) => unknown) {
          if (update && table === "email_campaign_recipients") {
            if (failSave && id.endsWith("-0")) return Promise.resolve({error:{message:"db down"}}).then(resolve);
            states.set(id, update.status!);
          }
          const data = table === "email_campaigns" && !update
            ? [{id:"campaign",event_id:"event",subject_template:"test",body_template:"hello",events:{title:"event"}}] : [];
          return Promise.resolve({data,count:0,error:null}).then(resolve);
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
    if(id.includes("smtp"))return {EmailDeliveryError:class extends Error{},sendBroadcastBatch:async(inputs:unknown[])=>{batchCalls++;assert.equal(inputs.length,2);return inputs.map((_,i)=>i===1&&!failSave?{errorCode:"postmark_406"}:{messageId:`id-${i}`});}};
    return {};
  },exports,class extends Date {static now(){return now;}});
  return {run:exports.processDueCampaignDeliveries as (options:object)=>Promise<{sent:number;failed:number}>,states,counts:()=>({claims,batchCalls})};
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
