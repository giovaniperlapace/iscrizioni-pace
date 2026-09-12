// Local synthetic UI; no production mutations or emails.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/success-message-check/", import.meta.url);
mkdirSync(route,{recursive:true});
copyFileSync(new URL("./success-message-fixture.tsx",import.meta.url),new URL("page.tsx",route));
const ab=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","success-message",...args],{encoding:"utf8",timeout:30000});
const check=(code,label)=>{assert.match(ab("eval",`Boolean(${code})`),/true/,label);console.log(`PASS ${label}`);};
try {
  ab("open",base);ab("snapshot","-i");
  check('document.body.innerText.trim().length>0 && !document.querySelector("[data-nextjs-dialog]")',"home loads");
  ab("open",`${base}/success-message-check?saved=attendance&q=Anna&assignmentId=synthetic&error=failed#details`);ab("snapshot","-i");
  ab("click","[data-update]");
  check('!!document.querySelector("[role=status]")',"success visible immediately");
  const timing=ab("eval",'(async()=>{await new Promise(r=>setTimeout(r,2000));const before=!!document.querySelector("[role=status]");await new Promise(r=>setTimeout(r,3500));return {before,after:!!document.querySelector("[role=status]")};})()');
  assert.match(timing,/"before":\s*true/);assert.match(timing,/"after":\s*false/);console.log("PASS auto-dismiss after five seconds");
  check('!!document.querySelector("[role=alert]") && !!document.querySelector("[data-instructions]")',"errors and instructions remain");
  check('!new URL(location.href).searchParams.has("saved") && new URL(location.href).searchParams.get("q")==="Anna" && new URL(location.href).searchParams.get("error")==="failed" && new URL(location.href).searchParams.get("assignmentId")==="synthetic" && location.hash==="#details"',"clears success marker preserving filters, selection, errors and hash");
  ab("click","[data-update]");ab("snapshot","-i");
  check('!!document.querySelector("[role=status]")',"same message can appear again");
  ab("click",'[aria-label="Chiudi messaggio"]');ab("snapshot","-i");
  check('!document.querySelector("[role=status]")',"manual dismissal");
  for(const [locale,label] of Object.entries({it:"Chiudi messaggio",en:"Dismiss message",fr:"Fermer le message",de:"Meldung schließen",es:"Cerrar mensaje",nl:"Bericht sluiten",uk:"Закрити повідомлення"})) {
    ab("select",'[aria-label="Lingua del messaggio"]',locale);ab("click","[data-update]");ab("snapshot","-i");
    check(`!!document.querySelector('[aria-label="${label}"]')`,`${locale} accessible close label`);
  }
  ab("set","viewport","390","844");ab("click","[data-update]");ab("snapshot","-i");
  check('document.documentElement.scrollWidth<=innerWidth',"mobile fits");
  ab("screenshot","/tmp/pace-success-message-mobile.png");
  assert.equal(ab("errors").trim(),"");
} finally {
  ab("close");rmSync(route,{recursive:true,force:true});
  rmSync(new URL("../../.next/dev/types/app/success-message-check/",import.meta.url),{recursive:true,force:true});
}
