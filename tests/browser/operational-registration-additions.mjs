// Local-only synthetic actions: never uses real registrations or sends email.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
const base = process.env.BASE_URL ?? "http://localhost:3012";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/operational-additions-check/", import.meta.url);
mkdirSync(route, { recursive: true });
for (const [source, target] of [["operational-children-editor", "children"], ["operational-accessibility-editor", "accessibility"]]) {
 writeFileSync(new URL(`${target}.tsx`, route), readFileSync(new URL(`../../app/dashboard/${source}.tsx`, import.meta.url), "utf8")
 .replaceAll('from "@/app/actions"', 'from "./action"').replaceAll('from "./operational-registration-actions"', 'from "./action"')
 .replace('from "./confirm-submit-button"', 'from "@/app/dashboard/confirm-submit-button"'));
}
writeFileSync(new URL("action.ts", route), `import type { FormFailure } from "@/lib/forms/result";
export async function updateOperationalChild(): Promise<FormFailure | {status:"success"}> { return {status:"success"}; }
export async function addOperationalChild(data: FormData): Promise<FormFailure | {status:"success"}> {
 document.body.dataset.addition=JSON.stringify(Object.fromEntries(data));
 if(data.get("firstName")==="Conflict") return {status:"error",issues:[{field:null,code:"conflict"}]};
 return {status:"success"};
}
export async function getOperationalAccessibility() {
 if(new URLSearchParams(location.search).has("failure")) return {status:"error" as const,issues:[{field:null,code:"failed"}]};
 return {status:"success" as const,snapshot:{answers:{hearing:true,walkingOrSteps:false,wheelchairOrMobilityAid:false},version:"v1"}};
}
export async function updateOperationalAccessibility(data:FormData) {
 document.body.dataset.accessibility=JSON.stringify(Object.fromEntries(data));
 if(new URLSearchParams(location.search).has("conflict")) return {status:"error" as const,issues:[{field:null,code:"conflict"}]};
 return {status:"success" as const,snapshot:{answers:Object.fromEntries(["hearing","walkingOrSteps","wheelchairOrMobilityAid"].map(k=>[k,data.get("accessibility_"+k)==="on"])),version:"v2"}};
}`);
writeFileSync(new URL("page.tsx", route), `import {OperationalChildrenEditor} from "./children";
import {OperationalAccessibilityEditor} from "./accessibility";
import type {SupportedLocale} from "@/lib/i18n/config";
export default async function Page({searchParams}:{searchParams:Promise<{locale?:SupportedLocale;readonly?:string}>}) {
 const p=await searchParams; const locale=p.locale??"it";
 return <main className="p-5 max-w-lg grid gap-6">
 {!p.readonly?<OperationalAccessibilityEditor registrationId="11111111-1111-4111-8111-111111111111" locale={locale}/>:null}
 <OperationalChildrenEditor registrationId="11111111-1111-4111-8111-111111111111" records={[]} locale={locale} editable={!p.readonly}/></main>;
}`);
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-additions", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { const result=ab("eval", code).trim(); if(result!=="true") console.log(ab("snapshot", "-i"), ab("eval", "document.body.innerText")); assert.equal(result, "true", label); console.log(`PASS ${label}`); };
function open(query="") { ab("open", `${base}/operational-additions-check${query}`); ab("snapshot", "-i"); }
try {
 for (const locale of (process.env.FOCUSED ? ["it"] : ["it","en","fr","de","es","nl","uk"])) {
  open(`?locale=${locale}`); ab("wait", 'input[name="accessibility_hearing"]');
  check('document.querySelector("[name=accessibility_hearing]").checked && document.querySelectorAll("main input[type=checkbox]").length===3 && !!document.querySelector("[name=firstName]")', `${locale}: existing needs and empty registration child addition`);
 }
 open(); ab("wait", 'input[name="accessibility_hearing"]');
 ab("uncheck", 'input[name="accessibility_hearing"]'); ab("check", 'input[name="accessibility_walkingOrSteps"]');
 ab("click", 'main section button[type="submit"]'); ab("snapshot", "-i");
 check('document.body.innerText.includes("Accessibilità aggiornata") && JSON.parse(document.body.dataset.accessibility).accessibility_walkingOrSteps==="on" && !JSON.parse(document.body.dataset.accessibility).accessibility_hearing', "save accessibility adds and removes needs");
 ab("fill", '[name="firstName"]', "Conflict"); ab("fill", '[name="lastName"]', "Rossi"); ab("eval", '(()=>{const field=document.querySelector("[name=birthDate]"); field.value="2018-05-20"; field.dispatchEvent(new Event("input",{bubbles:true})); field.dispatchEvent(new Event("change",{bubbles:true})); return field.value;})()');
 ab("click", 'main > div button[type="submit"]'); ab("snapshot", "-i");
 check('document.querySelector("[name=firstName]").value==="Conflict" && document.body.innerText.includes("Riapri")', "child failure retains input");
 ab("fill", '[name="firstName"]', "Anna"); ab("click", 'main > div button[type="submit"]'); ab("snapshot", "-i");
 check('document.body.innerText.includes("Figlio aggiunto") && document.querySelector("[name=firstName]").value==="" && /^[a-f0-9-]{36}$/.test(JSON.parse(document.body.dataset.addition).childId)', "child success clears form and uses request UUID");
 ab("set", "viewport", "390", "844");
 check('document.documentElement.scrollWidth <= innerWidth', "mobile fits viewport");
 ab("screenshot", "/tmp/pace-additions-mobile.png");
 open("?conflict=1"); ab("wait", 'input[name="accessibility_hearing"]');
 ab("check", 'input[name="accessibility_walkingOrSteps"]'); ab("click", 'main section button[type="submit"]'); ab("snapshot", "-i");
 check('document.querySelector("[name=accessibility_walkingOrSteps]").checked && document.body.innerText.includes("Riapri")', "accessibility conflict retains selections");
 open("?failure=1"); ab("wait", '[role="alert"]');
 check('!document.querySelector("[name=accessibility_hearing]") && document.body.innerText.includes("Riprova")', "read errors cannot overwrite existing needs");
 open("?readonly=1"); check('!document.querySelector("main button")', "readonly has no mutation controls");
 assert.equal(ab("errors").trim(), ""); console.log("PASS browser clean");
} finally { ab("close"); rmSync(route, {recursive:true,force:true}); rmSync(new URL("../../.next/dev/types/app/operational-additions-check/",import.meta.url),{recursive:true,force:true}); }
