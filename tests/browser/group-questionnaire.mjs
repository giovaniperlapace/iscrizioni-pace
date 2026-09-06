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
      check('document.querySelectorAll("button[data-field=hasPreviousSantegidioParticipation]").length === 2 && !document.querySelector("button[data-field=participatesWithGroup]") && !document.querySelector("[name=externalGroupAssociation]") && !document.querySelector("[data-field=group]")', `${locale} only first question visible, link=${link}`);
      choice("hasPreviousSantegidioParticipation", "no");
      check('!document.querySelector("button[data-field=participatesWithGroup]") && document.querySelector("[name=externalGroupAssociation]") && document.querySelector("[name=participatesWithGroup]").value === "no"', `${locale} first No opens association`);
      ab("fill", '[name="externalGroupAssociation"]', "Associazione sintetica");
      choice("hasPreviousSantegidioParticipation", "yes");
      check('document.querySelectorAll("button[data-field=participatesWithGroup]").length === 2 && document.querySelector("[name=participatesWithGroup]").value === "" && !document.querySelector("[name=externalGroupAssociation]")', `${locale} first Yes requires fresh group answer`);
      if (locale === "it") check('document.body.innerText.includes("Parteciperai alla Preghiera per la Pace con un gruppo della Comunità?")', "requested Italian wording");
      choice("participatesWithGroup", "no");
      check('document.querySelector("[name=externalGroupAssociation]").value === "" && !document.querySelector("[data-field=group]")', `${locale} second No opens empty association`);
      ab("fill", '[name="externalGroupAssociation"]', "Associazione sintetica");
      choice("participatesWithGroup", "yes");
      check('!document.querySelector("[name=externalGroupAssociation]") && document.querySelector("[data-field=group]")', `${locale} second Yes opens group selection`);
      if (link) check('document.querySelector("[name=groupId]").value === "22222222-2222-4222-8222-222222222222"', `${locale} reserved group remains selected`);
      else ab("check", '[name="cannotFindLeader"]');
      choice("hasPreviousSantegidioParticipation", "no");
      check('!document.querySelector("button[data-field=participatesWithGroup]") && !document.querySelector("[data-field=group]") && document.querySelector("[name=externalGroupAssociation]") && !new FormData(document.querySelector("form")).has("groupId") && !new FormData(document.querySelector("form")).has("cannotFindLeader")', `${locale} changing first answer clears group branch and payload`);
      choice("hasPreviousSantegidioParticipation", "yes");
      check('document.querySelector("[name=participatesWithGroup]").value === "" && !document.querySelector("[data-field=group]")', `${locale} group answer reset after first No`);
      choice("participatesWithGroup", "yes");
      if (!link) check('!document.querySelector("[name=cannotFindLeader]").checked', `${locale} missing-leader choice cleared`);
      choice("participatesWithGroup", "no");
      check('document.querySelector("[name=externalGroupAssociation]").value === "" && !document.querySelector("[data-field=group]")', `${locale} changing second answer clears group selection`);
    }
  }
  ab("open", `${base}/group-questionnaire-check?locale=it`); ab("snapshot", "-i");
  choice("hasPreviousSantegidioParticipation", "yes");
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
