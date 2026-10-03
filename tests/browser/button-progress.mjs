// Real React pending transitions, delayed local responses and portals. No real
// registration, database mutation or email is involved in this fixture.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/pending-feedback-check/", import.meta.url);
const download = new URL("../../app/pending-download-check/", import.meta.url);
mkdirSync(route, { recursive: true }); mkdirSync(download, { recursive: true });
copyFileSync(new URL("./pending-feedback-fixture.tsx", import.meta.url), new URL("pending-feedback-fixture.tsx", route));
copyFileSync(new URL("./pending-feedback-page.tsx", import.meta.url), new URL("page.tsx", route));
writeFileSync(new URL("route.ts", download), `export async function GET(request: Request) {
  await new Promise(resolve => setTimeout(resolve, 4000));
  if (new URL(request.url).searchParams.has("error")) return new Response("Synthetic failure", { status: 500 });
  return new Response("synthetic download", { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
}`);
const statisticsRoute = new URL("../../app/statistics-progress-check/", import.meta.url);
mkdirSync(statisticsRoute, { recursive: true });
// Render the real statistics component; redirect only its URLs to delayed local
// navigation so this regression never reaches authenticated data loaders.
writeFileSync(new URL("statistics.tsx", statisticsRoute), readFileSync(new URL("../../app/dashboard/statistics-section.tsx", import.meta.url), "utf8")
  .replaceAll("<Link", "<Link prefetch={false}")
  .replace('`/dashboard/${dashboard}?${params.toString()}`', '`/statistics-progress-check?dashboard=${dashboard}&${params.toString()}`'));
writeFileSync(new URL("page.tsx", statisticsRoute), readFileSync(new URL("./statistics-hierarchy-fixture.tsx", import.meta.url), "utf8")
  .replace('@/app/dashboard/statistics-section', './statistics')
  .replace('const {dashboard}=await searchParams;', 'const {dashboard}=await searchParams; if ("section" in await searchParams) await new Promise(resolve => setTimeout(resolve, 4000));'));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "button-progress", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => {
  assert.match(ab("eval", `(async () => Boolean(await (${code})))()`), /true/, label);
  console.log(`PASS ${label}`);
};
const run = (selector, success, label) => {
  ab("mouse", "move", "0", "0");
  check(`(async () => {
  await new Promise(r => setTimeout(r, 200));
  const button = document.querySelector(${JSON.stringify(selector)});
  const overlay = button.querySelector('.button-progress-overlay');
  const states = [];
  const observer = new MutationObserver(() => states.push(overlay.dataset.state));
  observer.observe(overlay, { attributes: true, attributeFilter: ['data-state'] });
  const before = button.getBoundingClientRect().width;
  const background = getComputedStyle(button).backgroundColor;
  button.click();
  await new Promise(r => setTimeout(r, 250));
  const earlyProgress = Number(getComputedStyle(overlay).transform.split(',')[0].replace('matrix(', ''));
  await new Promise(r => setTimeout(r, 350));
  const progress = Number(getComputedStyle(overlay).transform.split(',')[0].replace('matrix(', ''));
  const during = earlyProgress > .25 && overlay.dataset.state === 'pending' && progress > earlyProgress && progress < .9
    && getComputedStyle(overlay).opacity === '0.25'
    && getComputedStyle(button).cursor !== 'wait'
    && getComputedStyle(button, '::after').animationName !== 'work-spin'
    && getComputedStyle(button).backgroundColor === background
    && Math.abs(button.getBoundingClientRect().width - before) < 1;
  const diagnostic = { earlyProgress, progress, state: overlay.dataset.state, opacity: getComputedStyle(overlay).opacity,
    spinner: getComputedStyle(button, '::after').animationName, background,
    duringBackground: getComputedStyle(button).backgroundColor, before, duringWidth: button.getBoundingClientRect().width };
  await new Promise(r => setTimeout(r, 4500));
  observer.disconnect();
  const passed = during && states.includes('complete') === ${success}
    && overlay.dataset.state === 'idle' && !button.disabled;
  if (!passed) throw new Error(JSON.stringify({ ...diagnostic, states, after: overlay.dataset.state, disabled: button.disabled }));
  return passed;
})()`, label);
};

try {
  ab("open", `${base}/pending-feedback-check?extended=1`);
  console.log(ab("snapshot", "-i"));
  check('document.querySelector("[data-save][data-button-progress=true]") && !document.querySelector("[data-nextjs-dialog]")', "shared controls enable feedback without a route provider");
  ab("screenshot", "/tmp/pace-manager-progress-desktop.png");
  ab("click", "[data-save]");
  check('document.querySelector("[data-save] .button-progress-overlay").dataset.state === "idle" && !document.querySelector("[data-save]").disabled', "invalid form does not start an animation");
  ab("fill", '[aria-label="Nome"]', "Anna");
  run('[data-save]', true, "save preserves color and width, completes only after the real action");
  run('[data-fail]', false, "failed form stops without filling to 100 percent");
  run('[data-native]', true, "native React form pending works");
  run('[data-download]', true, "download completes after receiving the entire response");
  run('[data-download-error]', false, "download failure stops without showing completion");
  run('button[form="switch-service"]', false, "external form switch detects failure");
  run('button[form="switch-group"]', true, "external form switch completes after success");
  run('[data-statistics]', true, "query navigation uses Next link status");
  check('document.querySelector("[data-section]").textContent === "statistics"', "navigation reaches the requested section");
  ab("click", "[data-cancel]");
  check('!document.querySelector("[data-link-pending]")', "cancelled navigation does not animate");

  check(`(async () => {
    const button = document.querySelector('[data-held]');
    const overlay = button.querySelector('.button-progress-overlay');
    button.click();
    const samples = [];
    for (let i = 0; i < 11; i++) {
      await new Promise(r => setTimeout(r, 1000));
      samples.push(Number(overlay.style.transform.replace('scaleX(', '').replace(')', '')));
    }
    const held = button.disabled && overlay.dataset.state === 'pending';
    document.querySelector('[data-resolve]').click();
    await new Promise(r => setTimeout(r, 100));
    const complete = overlay.dataset.state === 'complete' && overlay.style.transform === 'scaleX(1)';
    // A retry during the final transition must cancel its previous cleanup.
    button.click();
    await new Promise(r => setTimeout(r, 500));
    const retried = button.disabled && overlay.dataset.state === 'pending';
    document.querySelector('[data-reject]').click();
    await new Promise(r => setTimeout(r, 100));
    return held && samples.at(-1) > .937
      && samples.every((value, i) => value < 1 && (!i || value > samples[i - 1]))
      && samples.at(-1) - samples.at(-2) < samples[4] - samples[3]
      && complete && retried && overlay.dataset.state === 'idle' && !button.disabled;
  })()`, "long waits keep advancing past 90 percent with decreasing speed; only real completion reaches 100 percent, retry and failure cancel old timers");

  ab("click", "[data-open-portal]");
  run('[data-portal-save]', true, "portal uses the same shared feedback without a provider");
  ab("click", "[data-close-portal]");
  for (const [locale, label] of Object.entries({ it:"Operazione in corso…", en:"Working…", fr:"Opération en cours…", de:"Wird bearbeitet…", es:"Operación en curso…", nl:"Bezig…", uk:"Виконується…" })) {
    ab("select", '[aria-label="Lingua indicatore"]', locale);
    check(`(async () => {
      const b = document.querySelector('[data-fail]'); b.click();
      await new Promise(r => setTimeout(r, 300));
      const translated = b.querySelector('[role=status]').textContent === ${JSON.stringify(label)};
      await new Promise(r => setTimeout(r, 4100));
      return translated && !b.disabled;
    })()`, `${locale} retains accessible status`);
  }
  ab("set", "viewport", "390", "844");
  ab("click", "[data-held]");
  ab("screenshot", "/tmp/pace-manager-progress-mobile.png");
  check('document.documentElement.scrollWidth <= innerWidth', "mobile fits during pending state");
  ab("eval", 'document.querySelector("[data-reject]").click()');
  ab("set", "media", "light", "reduced-motion");
  ab("click", "[data-held]");
  check('getComputedStyle(document.querySelector("[data-held] .button-progress-overlay")).transitionDuration === "0s"', "reduced motion disables movement");
  ab("eval", 'document.querySelector("[data-reject]").click()');
  ab("click", "[data-leave]");
  check('document.querySelector("[data-save][data-button-progress=true]")', "feedback remains enabled across routes");
  check(`(async () => {
    const b = document.querySelector('[data-fail]'); b.click();
    await new Promise(r => setTimeout(r, 400));
    return getComputedStyle(b, '::after').animationName !== 'work-spin' && b.querySelector('.button-progress-overlay').dataset.state === 'pending';
  })()`, "controls outside Manager also use the overlay");
  ab("set", "media", "light", "no-preference");
  for (const [dashboard, width] of [["manager", 1280], ["admin", 390]]) {
    ab("set", "viewport", String(width), "900");
    ab("open", `${base}/statistics-progress-check?dashboard=${dashboard}`);
    ab("snapshot", "-i");
    check(`(async () => {
      const link = document.querySelector('[data-statistics-report="age"] a');
      link.scrollIntoView({block:'center'});
      const label = link.children[0], count = link.children[1];
      const before = [label, count, link].map(e => {const r=e.getBoundingClientRect(); return [r.x, r.width, r.height];});
      link.click(); await new Promise(r => setTimeout(r, 500));
      const during = [label, count, link].map(e => {const r=e.getBoundingClientRect(); return [r.x, r.width, r.height];});
      const stable = JSON.stringify(before) === JSON.stringify(during);
      const pending = link.querySelector('.button-progress-overlay').dataset.state === 'pending';
      await new Promise(r => setTimeout(r, 4500));
      const after = [label, count, link].map(e => {const r=e.getBoundingClientRect(); return [r.x, r.width, r.height];});
      return stable && pending && JSON.stringify(before) === JSON.stringify(after);
    })()`, `${dashboard} ${width}px: real age statistics keep labels and counts fixed throughout navigation`);
  }
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(statisticsRoute, { recursive: true, force: true });
  rmSync(route, { recursive: true, force: true }); rmSync(download, { recursive: true, force: true });
  for (const name of ["pending-feedback-check", "pending-download-check", "statistics-progress-check"]) rmSync(new URL(`../../.next/dev/types/app/${name}/`, import.meta.url), { recursive: true, force: true });
}
