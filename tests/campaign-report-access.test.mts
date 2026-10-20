import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {timingSafeEqual} from 'node:crypto';
import {normalizePostmarkEvent} from '../lib/email/campaign-report.ts';
function moduleFrom(file:string,resolve:(id:string)=>unknown){const out:Record<string,unknown>={};const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',js)(resolve,out);return out;}
test('webhook rejects unauthenticated and invalid requests, ignores other streams, and retries persistence outages',async()=>{
 process.env.POSTMARK_WEBHOOK_SECRET='synthetic-secret';let writes=0;let unavailable=false;
 const mod=moduleFrom('app/api/webhooks/postmark/route.ts',id=>id==='node:crypto'?{timingSafeEqual}:id==='next/server'?{NextResponse:{json:Response.json}}:id.includes('campaign-report')?{normalizePostmarkEvent}:id.includes('config')?{getEmailConfig:()=>({broadcastStream:'broadcast'})}:{createSupabaseServiceClient:()=>({rpc:async(_name:string,{p_event}:{p_event:unknown})=>{writes++;assert.ok(!JSON.stringify(p_event).includes('secret body'));return {error:unavailable?{}:null};}})});
 const post=mod.POST as (r:Request)=>Promise<Response>;
 const payload={RecordType:'Delivery',MessageStream:'broadcast',MessageID:'11111111-1111-4111-8111-111111111111',Recipient:'a@example.invalid',DeliveredAt:'2026-10-19T08:40:00Z',HtmlBody:'secret body'};
 const request=(body:unknown,secret='synthetic-secret')=>new Request('https://example.invalid/api/webhooks/postmark',{method:'POST',headers:{'x-postmark-secret':secret},body:typeof body==='string'?body:JSON.stringify(body)});
 assert.equal((await post(request(payload,'bad'))).status,401);assert.equal(writes,0);
 assert.equal((await post(request({...payload,MessageStream:'outbound'}))).status,200);assert.equal(writes,0);
 assert.equal((await post(request({...payload,MessageStream:undefined}))).status,200);assert.equal(writes,0);
 assert.equal((await post(request('x'.repeat(65537)))).status,413);assert.equal((await post(request('{'))).status,400);assert.equal(writes,0);
 assert.equal((await post(request(payload))).status,200);assert.equal(writes,1);
 unavailable=true;assert.equal((await post(request(payload))).status,503);delete process.env.POSTMARK_WEBHOOK_SECRET;
});
test('report authorization denies viewer and foreign-event manager on freshly read roles',async()=>{
 let roles:{role:string;eventId:string|null}[]=[];
 const mod=moduleFrom('lib/email/campaign-report.server.ts',id=>id.includes('auth/session')?{getCurrentAuthContext:async()=>({user:{id:'user'},eventRoles:roles})}:id.includes('supabase/server')?{createSupabaseServerClient:async()=>({})}:id.includes('supabase/service')?{createSupabaseServiceClient:()=>({})}:id.includes('events/current')?{getCurrentOperationalEvent:async()=>({id:'event'})}:id.includes('management-access')?{canAccessPanelManagement:()=>true}:{});
 const access=mod.reportAccess as ()=>Promise<unknown>;
 roles=[{role:'manager_viewer',eventId:'event'}];await assert.rejects(access(),/Accesso non consentito/);
 roles=[{role:'manager',eventId:'other'}];await assert.rejects(access(),/Accesso non consentito/);
 roles=[{role:'manager',eventId:'event'}];await access();roles=[];await assert.rejects(access());
 roles=[{role:'admin',eventId:null}];await access();
});
test('retry endpoint enforces same-origin and explicit selection confirmation before dispatch',async()=>{
 let calls=0;
 const mod=moduleFrom('app/api/email-campaigns/reports/route.ts',id=>id==='next/server'?{NextResponse:{json:Response.json}}:id.includes('campaign-report.server')?{reportAccess:async()=>({}),retryCampaign:async()=>{calls++;return 'new';}}:{});
 const post=mod.POST as (r:Request)=>Promise<Response>;
 const request=(origin:string,confirm:boolean)=>new Request('https://example.invalid/api/email-campaigns/reports',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({campaignId:'11111111-1111-4111-8111-111111111111',recipientIds:['11111111-1111-4111-8111-111111111112'],confirm})});
 assert.equal((await post(request('https://attacker.invalid',true))).status,403);assert.equal((await post(request('https://example.invalid',false))).status,400);assert.equal(calls,0);
 assert.equal((await post(request('https://example.invalid',true))).status,200);assert.equal(calls,1);
});
