import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as confirmation from "../lib/auth/magic-link-confirmation.ts";
import * as locale from "../lib/i18n/config.ts";
import * as persistence from "../lib/auth/session-persistence.ts";
import { buildAppMagicLink } from "../lib/registrations/magic-link.ts";

function harness(failVerification = false) {
  let clients = 0, verified = 0, exchanged = 0, linked = 0;
  let user: object | null = null;
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  class MockResponse extends Response {
    cookies = {set() {}};
    static redirect(url: URL, status = 307) { return new MockResponse(null,{status,headers:{location:url.toString()}}); }
  }
  const code=ts.transpileModule(readFileSync(new URL("../app/auth/callback/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","exports",code)((id:string)=>{
    if(id==="next/server") return {NextResponse:MockResponse};
    if(id.includes("magic-link-confirmation")) return confirmation;
    if(id.includes("i18n/config")) return locale;
    if(id.includes("auth/roles")) return {isDashboardRole:(role:string)=>role==="partecipante"};
    if(id.includes("auth/session-persistence")) return persistence;
    if(id.includes("auth/session")) return {ensureCurrentUserProfile:async()=>{},getCurrentAuthContext:async()=>({dashboardPath:"/dashboard/partecipante"})};
    if(id.includes("supabase/server")) return {createSupabaseServerClient:async()=>{
      clients++;
      return {auth:{
        verifyOtp:async(value:{token_hash:string})=>{assert.equal(value.token_hash,"synthetic");verified++;if(!failVerification)user={id:"synthetic-user",email:"person@example.test"};return {error:failVerification?new Error("expired"):null};},
        exchangeCodeForSession:async()=>{exchanged++;user={id:"synthetic-user"};return {error:null};},
        getUser:async()=>({data:{user}}),
      }};
    }};
    if(id.includes("supabase/service")) return {createSupabaseServiceClient:()=>({})};
    if(id.includes("public-flow")) return {linkParticipantsToUserByEmail:async()=>{linked++;}};
    throw Error(`Unexpected import ${id}`);
  },exports);
  return { GET: exports.GET, POST: exports.POST, counts:()=>({clients,verified,exchanged,linked}) };
}

function request(method: string, params: string, origin="https://local.example.test") {
  const r=new Request(`https://local.example.test/auth/callback${method==="GET"?`?${params}`:""}`,{
    method,headers:{origin,"accept-language":"it","content-type":"application/x-www-form-urlencoded"},
    ...(method==="POST"?{body:params}:{}),
  });
  return Object.assign(r,{cookies:{get:()=>undefined}});
}

test("repeated scanner GETs never create an auth client or consume OTP/PKCE", async()=>{
  const h=harness();
  for(const params of ["token_hash=synthetic&type=email","token=synthetic&type=magiclink","code=synthetic-code"]) {
    for(let i=0;i<2;i++) {
      const response=await h.GET(request("GET",params));
      assert.equal(response.status,200);
      assert.match(response.headers.get("cache-control")!,/no-store/);
      assert.equal(response.headers.get("referrer-policy"),"strict-origin");
      const html=await response.text();
      assert.match(html,/<form method="post" action="\/auth\/callback">/);
      assert.doesNotMatch(html,/<script|http-equiv="refresh"|prefetch/);
    }
  }
  assert.deepEqual(h.counts(),{clients:0,verified:0,exchanged:0,linked:0});
});

test("explicit same-origin confirmation verifies once and redirects with GET semantics",async()=>{
  const h=harness();
  const response=await h.POST(request("POST","token_hash=synthetic&type=email&role=partecipante&redirect_to=%2Fdashboard%2Fpartecipante%3Ftab%3Dprofile"));
  assert.equal(response.status,303);
  assert.equal(response.headers.get("location"),"https://local.example.test/dashboard/partecipante?tab=profile");
  assert.deepEqual(h.counts(),{clients:1,verified:1,exchanged:0,linked:1});
  assert.equal(response.headers.get("referrer-policy"),"strict-origin");
});

test("PKCE confirms on POST; invalid links keep the existing login error flow",async()=>{
  const h=harness();
  assert.equal((await h.POST(request("POST","code=synthetic"))).status,303);
  assert.equal(h.counts().exchanged,1);
  const invalid=harness(true);
  const response=await invalid.POST(request("POST","token_hash=synthetic&type=email"));
  assert.equal(response.headers.get("location"),"https://local.example.test/login?error=otp");
  assert.equal(invalid.counts().linked,0);
});

test("cross-origin or missing-token posts cannot start authentication",async()=>{
  const h=harness();
  assert.equal((await h.POST(request("POST","token_hash=synthetic&type=email","https://other.example.test"))).status,403);
  assert.equal((await h.POST(request("POST","token_hash=synthetic&type=email",""))).status,403);
  assert.equal((await h.POST(request("POST","type=email"))).status,303);
  assert.equal(h.counts().clients,0);
});

test("confirmation is translated and safely escapes untrusted token fields",()=>{
  for(const language of locale.SUPPORTED_LOCALES) {
    const html=confirmation.renderMagicLinkConfirmation(new URLSearchParams({token_hash:'"><script>alert(1)</script>',type:"email"}),language);
    assert.match(html,new RegExp(`<html lang="${language}">`));
    assert.doesNotMatch(html,/<script>/);
    assert.match(html,/&lt;script&gt;/);
  }
});

test("new emails never fall back to a Supabase link that consumes the token before confirmation", async () => {
  const source=readFileSync(new URL("../lib/registrations/public-flow.ts",import.meta.url),"utf8");
  const start=source.indexOf("export async function sendMagicLinkEmail(");
  const end=source.indexOf("export async function createPublicRegistration(",start);
  const js=ts.transpileModule(source.slice(start,end).replace("export async", "async"),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const sent: object[]=[];
  const send = new Function("sendTransactionalEmail","renderMagicLinkEmail","buildAppMagicLink", `${js};return sendMagicLinkEmail;`)(
    async (input:object)=>{sent.push(input);}, (input:object)=>input, buildAppMagicLink
  );
  const client=(properties:object)=>({auth:{admin:{generateLink:async()=>({data:{properties},error:null})}}});
  await assert.rejects(send(client({action_link:"https://supabase.invalid/verify"}),"person@example.test","https://app.example.test/auth/callback"),/did not return/);
  assert.equal(sent.length,0);
  await send(client({hashed_token:"synthetic",action_link:"https://supabase.invalid/verify"}),"person@example.test","https://app.example.test/auth/callback");
  assert.deepEqual(sent,[{to:"person@example.test",actionLink:"https://app.example.test/auth/callback?token_hash=synthetic&type=email"}]);
});
