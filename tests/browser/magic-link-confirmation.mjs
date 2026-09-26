// Run against the clean-copy build configured with Supabase http://127.0.0.1:39991.
// Only synthetic tokens; no production network, users, sessions or emails.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const base = process.argv[2] ?? "http://localhost:3120";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error("Local app required");
const exec = promisify(execFile);
const ab = async (...args) => (await exec("npx", ["--yes", "agent-browser", "--session", "pace-magic-confirmation", ...args], {timeout:30000})).stdout;
let verifications = 0;
const auth = createServer((request,response)=>{
  if(request.url === "/auth/v1/verify") verifications++;
  response.writeHead(400,{"Content-Type":"application/json"});
  response.end(JSON.stringify({code:"otp_expired",message:"Synthetic expired token"}));
});
await new Promise(resolve=>auth.listen(39991,"127.0.0.1",resolve));
const url = `${base}/auth/callback?token_hash=synthetic&type=email`;
try {
  for(const method of ["GET","HEAD","GET"]) {
    const response = await fetch(url,{method});
    assert.equal(response.status,200);
    assert.match(response.headers.get("cache-control"),/no-store/);
  }
  assert.equal(verifications,0,"scanner must not reach Auth");
  await ab("open",url);
  assert.match(await ab("snapshot","-i"),/button/);
  assert.match(await ab("eval",'document.body.innerText.length > 0 && document.querySelectorAll("script").length === 1 && !document.querySelector("[data-nextjs-dialog]")'),/true/);
  for(const [locale,label] of Object.entries({it:"Conferma e accedi",en:"Confirm and sign in",fr:"Confirmer et se connecter",de:"Bestätigen und anmelden",es:"Confirmar y acceder",nl:"Bevestigen en inloggen",uk:"Підтвердити та увійти"})) {
    await ab("eval",`document.cookie="iscrizioni_locale=${locale};path=/"`);
    await ab("open",url);
    assert.match(await ab("snapshot","-i"),new RegExp(label));
  }
  assert.equal(verifications,0,"rendering and changing language must not consume token");
  await ab("eval",'document.cookie="iscrizioni_locale=it;path=/"');
  await ab("open",url);
  await ab("screenshot","/tmp/pace-magic-confirmation-desktop.png");
  await ab("set","viewport","390","844");
  assert.match(await ab("eval","document.documentElement.scrollWidth <= innerWidth"),/true/);
  await ab("screenshot","/tmp/pace-magic-confirmation-mobile.png");
  assert.equal((await ab("errors")).trim(),"");
  await ab("click",'button[type="submit"]');
  await ab("wait","--url","**/login?error=otp");
  assert.equal(verifications,1,"only explicit native POST reaches Auth");
  console.log("PASS repeated GET/HEAD, seven languages, desktop/mobile, single guarded script/no errors, explicit POST reaches local Auth once and expired token returns to login");
} finally {
  await ab("close");
  await new Promise(resolve=>auth.close(resolve));
}
