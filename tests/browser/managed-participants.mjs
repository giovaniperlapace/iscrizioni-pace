// Uses only synthetic data and components, with local server validation. Database
// transactions and role boundaries are exercised by tests/sql/delegated-participants.sql.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base=process.argv[2] ?? "http://localhost:3110";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route=new URL("../../app/managed-participants-check/",import.meta.url);
mkdirSync(route,{recursive:true});
writeFileSync(new URL("page.tsx",route),'export { default } from "@/tests/browser/managed-participants-fixture";\n');
const ab=(...args)=>execFileSync("npx",["--yes","agent-browser","--session","pace-delegated",...args],{encoding:"utf8",timeout:60000});
const check=(code,label)=>{ assert.match(ab("eval",`Boolean(${code})`),/true/,label); console.log(`PASS ${label}`); };
try {
 ab("open",`${base}/managed-participants-check`); ab("snapshot","-i");
 check('document.querySelector("[data-testid=participant-qr] img").src.startsWith("data:image/png;base64,")',"real PNG QR");
 check('document.querySelector("a[download]").download === "qr-T3ST.png"',"personal QR download");
 check('document.querySelector("[name=email]").value === "" && document.querySelector("[name=phone]").value === ""',"no fabricated personal contacts");
 ab("check",'[name="consentConfirmed"]');
 ab("select",'[name="deliveryMode"]',"personal"); ab("click",'button[type="submit"]');
 check('document.activeElement.name === "email" && document.querySelector("[role=dialog]")',"missing direct email stays in the form");
 check('document.querySelector("[name=firstName]").value === "Persona" && document.querySelector("[name=consentConfirmed]").checked',"values retained after validation");
 ab("select",'[name="deliveryMode"]',"delegated"); ab("snapshot","-i");
 ab("eval",'document.querySelector("button[type=submit]").scrollIntoView({block:"center",behavior:"instant"})');
 ab("click",'button[type="submit"]');
 ab("wait","--url","**saved=1");
 check('document.querySelector("[role=status]").textContent === "Salvato senza contatti personali"',"email-less and phone-less successful submit");
 ab("open",`${base}/managed-participants-check`); ab("set","viewport","390","844"); ab("snapshot","-i");
 check('document.documentElement.scrollWidth <= innerWidth',"mobile width fits");
 check('document.querySelector("[role=dialog]").scrollHeight > document.querySelector("[role=dialog]").clientHeight',"long card scrolls inside modal");
 ab("eval",'document.querySelector("[role=dialog]").scrollTop = document.querySelector("[role=dialog]").scrollHeight');
 check('document.querySelector("button[type=submit]").getBoundingClientRect().bottom <= innerHeight',"submit reachable at bottom");
 ab("screenshot","/tmp/pace-delegated-mobile.png");
 for (const locale of ["en","fr","de","es","nl","uk"]) {
   ab("open",`${base}/managed-participants-check?locale=${locale}`); ab("snapshot","-i");
   check('document.querySelector("[name=deliveryMode]").options.length === 2 && document.querySelector("[data-testid=participant-qr] img")',`${locale} localized card and routing`);
 }
 assert.equal(ab("errors").trim(),""); console.log("PASS no browser errors");
} finally {
 ab("close"); rmSync(route,{recursive:true,force:true});
 rmSync(new URL("../../.next/dev/types/app/managed-participants-check/",import.meta.url),{recursive:true,force:true});
}
