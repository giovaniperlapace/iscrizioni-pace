import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3116";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const routes = ["leader-participants", "participant-operations"];
const ab = (...args) => execFileSync(process.env.AGENT_BROWSER_BIN ?? "npx", [...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]), "--session", "attendance-columns", ...args], {encoding: "utf8", timeout: 60000});
const check = (code, label) => { assert.match(ab("eval", `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
try {
  for (const name of routes) {
    const route = new URL(`../../app/${name}-check/`, import.meta.url);
    mkdirSync(route, {recursive: true});
    writeFileSync(new URL("page.tsx", route), `export { default } from "@/tests/browser/${name}-fixture";`);
  }
  for (const name of routes) {
    ab("open", `${base}/${name}-check?columns=name,attendance,email`);
    ab("snapshot", "-i");
    check('document.querySelectorAll("thead th").length === 9', `${name}: seven moment columns plus name and email`);
    check('document.querySelectorAll("thead th")[1].textContent === "24 ottobre · Pomeriggio" && document.querySelectorAll("thead th")[7].textContent === "27 ottobre · Pomeriggio"', `${name}: complete event calendar`);
    check('document.querySelectorAll("tbody tr")[0].children[2].textContent === "Sì" && document.querySelectorAll("tbody tr")[0].children[3].textContent === "No"', `${name}: yes and no by moment`);
    check('document.querySelectorAll("tbody tr")[1].children[2].textContent === "Da comunicare"', `${name}: unknown preserved`);
    for (const width of [1280, 390]) {
      ab("set", "viewport", String(width), "844");
      check('document.documentElement.scrollWidth <= innerWidth + 1', `${name}: page contained at ${width}px`);
    }
    ab("eval", 'document.querySelector("table").scrollIntoView({block: "start"})');
    ab("screenshot", `/tmp/${name}-attendance-columns.png`);
    if (name === "leader-participants") {
      for (const [locale, yes, no, unknown] of [["en","Yes","No","To be confirmed"],["fr","Oui","Non","À communiquer"],["de","Ja","Nein","Noch mitzuteilen"],["es","Sí","No","Por comunicar"],["nl","Ja","Nee","Nog door te geven"],["uk","Так","Ні","Буде повідомлено"],["it","Sì","No","Da comunicare"]]) {
        ab("select", "select[aria-label='Lingua fixture']", locale);
        check(`document.querySelectorAll("tbody tr")[0].children[2].textContent === ${JSON.stringify(yes)} && document.querySelectorAll("tbody tr")[0].children[3].textContent === ${JSON.stringify(no)} && document.querySelectorAll("tbody tr")[1].children[2].textContent === ${JSON.stringify(unknown)}`, `localized moment cells ${locale}`);
      }
    }
    const errors = ab("errors");
    assert.ok(!errors.trim() || /No errors/i.test(errors), errors);
    ab("open", `${base}/${name}-check?columns=name,email`);
    ab("snapshot", "-i");
    check('document.querySelectorAll("thead th").length === 2', `${name}: hidden attendance removes all moment columns`);
  }
} finally {
  ab("close");
  for (const name of routes) rmSync(new URL(`../../app/${name}-check/`, import.meta.url), {recursive: true, force: true});
}
