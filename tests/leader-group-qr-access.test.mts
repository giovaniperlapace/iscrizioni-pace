import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { groupQrFilename, participantQrFilename } from "../lib/qrcode/filename.ts";

const groupId = "00000000-0000-4000-8000-000000000001";
function actionFixture({admin=false,scope=true,authenticated=true,roleError=false,active=true,rpcError=false}={}) {
 const calls: unknown[]=[];let services=0;
 const session={auth:{getUser:async()=>({data:{user:authenticated?{id:"actor"}:null},error:null})},from:(table:string)=>({select:()=>({eq:()=>table==="events"?{maybeSingle:async()=>({data:{id:"event"},error:null})}:Promise.resolve({data:admin?[{role:"admin",event_id:null}]:[{role:"capogruppo",event_id:"event"}],error:roleError?{}:null})})})};
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
