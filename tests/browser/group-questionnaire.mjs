// Synthetic form only: no submit, registration, or email.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/group-questionnaire-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./group-questionnaire-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "operative-groups", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.match(ab("eval", `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
const choice = (name, value) => ab("click", `button[data-field="${name}"]:nth-of-type(${value === "yes" ? 1 : 2})`);
try {
  ab("open", base); ab("snapshot", "-i");
  check('document.body.innerText.trim().length > 0 && !document.querySelector("[data-nextjs-dialog]")', "home loads without framework overlay");
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    for (const link of [false, true]) {
      ab("open", `${base}/group-questionnaire-check?locale=${locale}${link ? "&link=1" : ""}`);
      ab("snapshot", "-i");
      check('document.querySelectorAll("button[data-field=hasPreviousSantegidioParticipation]").length === 2 && document.querySelectorAll("button[data-field=participatesWithGroup]").length === 2', `${locale} both questions visible, link=${link}`);
      check('document.querySelector("[name=hasPreviousSantegidioParticipation]").value === ""', `${locale} previous attendance not assumed from link`);
      choice("participatesWithGroup", "no");
      ab("fill", '[name="externalGroupAssociation"]', "Associazione sintetica");
      choice("hasPreviousSantegidioParticipation", "yes");
      check('document.querySelector("[name=externalGroupAssociation]").value === "Associazione sintetica" && document.querySelector("[name=participatesWithGroup]").value === "no"', `${locale} independent No and association`);
      choice("hasPreviousSantegidioParticipation", "no");
      check('document.querySelector("[name=externalGroupAssociation]").value === "Associazione sintetica"', `${locale} first answer preserves association`);
      choice("participatesWithGroup", "yes");
      check('!document.querySelector("[name=externalGroupAssociation]") && document.querySelector("[name=hasPreviousSantegidioParticipation]").value === "no"', `${locale} Yes hides association without changing first answer`);
      if (link) check('document.querySelector("[name=groupId]").value === "22222222-2222-4222-8222-222222222222"', `${locale} reserved group remains selected`);
    }
  }
  ab("open", `${base}/group-questionnaire-check?locale=it`); ab("snapshot", "-i");
  choice("participatesWithGroup", "no");
  ab("eval", 'document.querySelector("[name=hasPreviousSantegidioParticipation]").closest("section").scrollIntoView({block:"center"})');
  ab("screenshot", "/tmp/operative-groups-questionnaire-desktop.png");
  ab("set", "viewport", "390", "844");
  ab("eval", 'document.querySelector("[name=hasPreviousSantegidioParticipation]").closest("section").scrollIntoView({block:"center"})');
  ab("screenshot", "/tmp/operative-groups-questionnaire-mobile.png");
  check('document.documentElement.scrollWidth <= window.innerWidth', "mobile fits viewport");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/group-questionnaire-check/", import.meta.url), { recursive: true, force: true });
}
