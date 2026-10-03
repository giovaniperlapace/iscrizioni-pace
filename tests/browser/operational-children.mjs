// Synthetic local editor: replace only the action import, never call production writes.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
const base = process.env.BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/operational-children-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(new URL("editor.tsx", route), readFileSync(new URL("../../app/dashboard/operational-children-editor.tsx", import.meta.url), "utf8")
  .replace('from "@/app/actions"', 'from "./action"').replace('from "./operational-registration-actions"', 'from "./action"').replace('from "./confirm-submit-button"', 'from "@/app/dashboard/confirm-submit-button"'));
writeFileSync(new URL("action.ts", route), `import type { FormFailure } from "@/lib/forms/result";
export async function addOperationalChild(): Promise<{status: "success"}> { return {status:"success"}; }
export async function updateOperationalChild(data: FormData): Promise<FormFailure | {status: "success"}> {
 document.body.dataset.childResult = JSON.stringify(Object.fromEntries(data));
 if (data.get("firstName") === "Conflict") return {status:"error",issues:[{field:null,code:"conflict"}]};
 return {status:"success"};
}`);
writeFileSync(new URL("page.tsx", route), `import { OperationalChildrenEditor } from "./editor";
import type { SupportedLocale } from "@/lib/i18n/config";
export default async function Page({searchParams}:{searchParams:Promise<{locale?: SupportedLocale; readonly?:string}>}) {
 const p=await searchParams;
 return <main className="p-5 max-w-lg"><OperationalChildrenEditor locale={p.locale ?? "it"} editable={!p.readonly} records={[
 {id:"11111111-1111-4111-8111-111111111111",first_name:"Anna",last_name:"Rossi",birth_date:"1990-01-01"},
 {id:"22222222-2222-4222-8222-222222222222",first_name:"Luca",last_name:"Rossi",birth_date:"2016-02-29"}]} /></main>;
}`);
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-child-edit", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.equal(ab("eval", code).trim(), "true", label); console.log(`PASS ${label}`); };
try {
 for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
  ab("open", `${base}/operational-children-check?locale=${locale}`); ab("snapshot", "-i");
  check('document.querySelectorAll("[name=firstName]").length === 2 && document.querySelector("[name=birthDate]").value === "1990-01-01"', `${locale}: existing children and historical dates`);
 }
 ab("open", `${base}/operational-children-check?locale=it`); ab("snapshot", "-i");
 ab("fill", 'main > div > div:first-of-type [name=firstName]', "Conflict");
 ab("click", 'main > div > div:first-of-type [value=save]'); ab("snapshot", "-i");
 check('document.querySelector("[role=alert]").textContent.includes("Riapri") && document.querySelector("[name=firstName]").value === "Conflict"', "conflict retains edits and explains reload");
 ab("fill", 'main > div > div:first-of-type [name=firstName]', "Anna Maria");
 ab("click", 'main > div > div:first-of-type [value=save]'); ab("snapshot", "-i");
 check('JSON.parse(document.body.dataset.childResult).firstName === "Anna Maria" && document.body.innerText.includes("Dati del figlio salvati")', "save submits child details and confirms success");
 ab("eval", 'window.confirm = () => false');
 ab("click", 'main > div > div:first-of-type [value=delete]'); ab("snapshot", "-i");
 check('document.querySelectorAll("[name=firstName]").length === 2 && JSON.parse(document.body.dataset.childResult).intent === "save"', "cancel leaves children unchanged");
 ab("eval", 'window.confirm = () => true');
 ab("click", 'main > div > div:first-of-type [value=delete]'); ab("snapshot", "-i");
 check('document.querySelectorAll("[name=firstName]").length === 1 && document.querySelector("[name=firstName]").value === "Luca" && JSON.parse(document.body.dataset.childResult).intent === "delete"', "confirmed removal affects selected child only");
 ab("set", "viewport", "390", "844");
 check('document.documentElement.scrollWidth <= innerWidth', "mobile fits viewport");
 ab("screenshot", "/tmp/pace-child-editor-mobile.png");
 ab("open", `${base}/operational-children-check?readonly=1`); ab("snapshot", "-i");
 check('!document.querySelector("[value=save]") && !document.querySelector("[value=delete]") && document.body.innerText.includes("Anna")', "read-only view has no mutation controls");
 assert.equal(ab("errors").trim(), "");
 console.log("PASS no browser errors; synthetic actions only");
} finally {
 ab("close");
 rmSync(route, { recursive: true, force: true });
 rmSync(new URL("../../.next/dev/types/app/operational-children-check/", import.meta.url), { recursive: true, force: true });
}
