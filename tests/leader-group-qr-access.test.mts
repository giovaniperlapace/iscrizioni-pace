import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { groupQrFilename, participantQrFilename } from "../lib/qrcode/filename.ts";

const groupId = "00000000-0000-4000-8000-000000000001";
function actionFixture({admin=false,manager=false,managerEvent="event",scope=true,authenticated=true,roleError=false,active=true,rpcError=false}={}) {
 const calls: unknown[]=[];let services=0;
 const session={auth:{getUser:async()=>({data:{user:authenticated?{id:"actor"}:null},error:null})},from:(table:string)=>({select:()=>({eq:()=>table==="events"?{maybeSingle:async()=>({data:{id:"event"},error:null})}:Promise.resolve({data:admin?[{role:"admin",event_id:null}]:manager?[{role:"manager",event_id:managerEvent}]:[{role:"capogruppo",event_id:"event"}],error:roleError?{}:null})})})};
 const deps:Record<string,unknown>={
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>session},
  "@/lib/supabase/service":{createSupabaseServiceClient:()=>{services++;return {rpc:async(name:string,args:unknown)=>{calls.push({name,args});return {data:{active,encrypted:"encrypted",hash:"hash"},error:rpcError?{}:null};}};}},
  "@/lib/qrcode/token":{createOpaqueQrToken:()=>({token:"x".repeat(43),tokenHash:"hash"}),hashQrToken:()=>"hash"},
  "@/lib/qrcode/secure-token":{encryptQrToken:()=>"encrypted",decryptQrToken:()=>"x".repeat(43)},
  "@/lib/groups/leader-data.server":{loadLeaderScope:async()=>({scopedGroupIds:new Set(scope?[groupId]:[])})},
  "@/lib/qrcode/render":{renderQrDataUrl:async(token:string)=>`rendered:${token}`},
 };
 const source=ts.transpileModule(readFileSync(new URL("../app/dashboard/capogruppo/qr-gruppo/actions.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exported={} as {groupReceptionQr:(id:string,action:string)=>Promise<{status:string;image?:string}>};
 new Function("require","exports",source)((name:string)=>{assert.ok(name in deps,name);return deps[name];},exported);
 return {call:exported.groupReceptionQr,calls,services:()=>services};
}
test("leader can fetch own group QR; no privileged client for foreign scope, revoked session or management attempts",async()=>{
 const own=actionFixture();assert.deepEqual(await own.call(groupId,"get"),{status:"active",image:`rendered:G:${"x".repeat(43)}`});assert.equal(own.calls.length,1);
 for(const options of [{scope:false},{authenticated:false},{roleError:true}]){
  const f=actionFixture(options);assert.equal((await f.call(groupId,"get")).status,"unavailable");assert.equal(f.services(),0);
 }
 for(const action of ["renew","revoke","unknown"]){const f=actionFixture();assert.equal((await f.call(groupId,action)).status,"unavailable");assert.equal(f.services(),0);}
});
test("Admin can only read; forged management attempts never reach privileged client",async()=>{
 const admin=actionFixture({admin:true,scope:false});assert.equal((await admin.call(groupId,"get")).status,"active");assert.equal(admin.calls.length,1);
 for(const action of ["revoke","renew","unknown",null,undefined]){const f=actionFixture({admin:true,scope:false});assert.equal((await f.call(groupId,action as string)).status,"unavailable");assert.equal(f.services(),0);}
 for(const options of [{active:false},{rpcError:true}]){const f=actionFixture(options);const result=await f.call(groupId,"get");assert.notEqual(result.status,"active");assert.equal(result.image,undefined);}
});
test("group download names identify the group and safely preserve international names",()=>{
 assert.equal(groupQrFilename("Anziani - Torrenova"),"qr-gruppo-Anziani-Torrenova.png");
 assert.equal(groupQrFilename("Група Київ / École"),"qr-gruppo-Група-Київ-École.png");
 assert.equal(groupQrFilename("../../Test\\Nome\r\n:*?"),"qr-gruppo-Test-Nome.png");
 assert.equal(groupQrFilename(""),"qr-gruppo-gruppo.png");
 assert.ok(Array.from(groupQrFilename("é".repeat(200))).length<100);
 assert.equal(participantQrFilename("Ada Mori"),"qr-Ada-Mori.png");
});

test("Manager group QR access requires the current event and respects database denials",async()=>{
 const manager=actionFixture({manager:true,scope:false});
 assert.equal((await manager.call(groupId,"get")).status,"active");
 assert.equal(manager.services(),1);
 for(const options of [{manager:true,managerEvent:"other",scope:false},{manager:true,managerEvent:"",scope:false},{manager:true,roleError:true}]){
  const f=actionFixture(options);assert.equal((await f.call(groupId,"get")).status,"unavailable");assert.equal(f.services(),0);
 }
 const denied=actionFixture({manager:true,scope:false,rpcError:true});
 assert.equal((await denied.call(groupId,"get")).status,"unavailable");
 for(const action of ["renew","revoke",null]){
  const f=actionFixture({manager:true,scope:false});assert.equal((await f.call(groupId,action as string)).status,"unavailable");assert.equal(f.services(),0);
 }
});

test("group QR HTTP opening requires same origin and delegates only get to the existing scope gate", async () => {
 const { NextRequest, NextResponse } = await import("next/server.js");
 for (const scenario of ["valid", "foreign-origin", "missing-origin", "bad-id", "revoke", "malformed", "denied"]) {
  const calls: unknown[] = [];
  const source = ts.transpileModule(readFileSync("app/dashboard/groups/qr/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exported = {} as { POST: (request: InstanceType<typeof NextRequest>) => Promise<Response> };
  new Function("require", "exports", source)((name: string) => name === "next/server" ? { NextResponse } : {
   groupReceptionQr: async (id: string, action: string) => { calls.push([id, action]); return { status: scenario === "denied" ? "unavailable" : "active" }; },
  }, exported);
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (scenario !== "missing-origin") headers.origin = scenario === "foreign-origin" ? "https://elsewhere.invalid" : "http://localhost";
  const response = await exported.POST(new NextRequest("http://localhost/dashboard/groups/qr", {
   method: "POST", headers, body: scenario === "malformed" ? "{" : JSON.stringify({ groupId: scenario === "bad-id" ? "bad" : groupId, ...(scenario === "revoke" ? { action: "revoke" } : {}) }),
  }));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const allowed = ["valid", "denied"].includes(scenario);
  assert.equal(response.status, allowed ? 200 : scenario.includes("origin") ? 403 : 400);
  assert.deepEqual(calls, allowed ? [[groupId, "get"]] : []);
  if (scenario === "denied") assert.deepEqual(await response.json(), { status: "unavailable" });
 }
});

test("group label HTTP reads retain canonical permissions and never accept printing commands", async () => {
 const { NextRequest, NextResponse } = await import("next/server.js");
 const source = ts.transpileModule(readFileSync("app/dashboard/groups/qr/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
 for (const action of [undefined, "request", "outcome", "verify"]) {
  const calls: unknown[] = [];
  const exported = {} as { POST: (r: InstanceType<typeof NextRequest>) => Promise<Response> };
  new Function("require", "exports", source)((name: string) => name === "next/server" ? { NextResponse } : {
   qrLabelCommand: async (input: unknown) => { calls.push(input); return { status: "forbidden" }; },
   groupReceptionQr: () => { throw Error("Unexpected group credential"); },
  }, exported);
  const response = await exported.POST(new NextRequest("http://localhost/dashboard/groups/qr", {
   method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ groupId, kind: "labels", action }),
  }));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.status, action ? 400 : 200);
  assert.deepEqual(calls, action ? [] : [{ groupId, action: "read" }]);
  if (!action) assert.deepEqual(await response.json(), { status: "forbidden" });
 }
});
