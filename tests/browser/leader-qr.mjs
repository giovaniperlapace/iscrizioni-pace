import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
import { renderParticipantQrPng } from "../../lib/qrcode/participant-card.ts";
const base = process.argv[2] ?? "http://localhost:3116";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local server required");
const route = new URL("../../app/leader-qr-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(
  new URL("page.tsx", route),
  'export { default } from "@/tests/browser/leader-qr-fixture";',
);
const ab = (...args) =>
  execFileSync(
    process.env.AGENT_BROWSER_BIN ?? "npx",
    [
      ...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]),
      "--session",
      "leader-qr",
      ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
const check = (expression, label) => {
  assert.match(ab("eval", `Boolean(${expression})`), /true/, label);
  console.log(`PASS ${label}`);
};
try {
  ab("open", `${base}/leader-qr-check`);
  ab("snapshot", "-i");
  check(
    'document.querySelector("img[alt*=Anna]")?.complete && document.body.innerText.includes("QR code attivo")',
    "selected participant QR visible with active status",
  );
  check(
    'document.querySelector("a[download]").href !== document.querySelector("img[alt*=Anna]").src && document.querySelector("a[download]").download === "qr-Anna-Bianchi.png"',
    "download uses a separate named PNG and participant name",
  );
  ab("download", "a[download]", "/tmp/pace-leader-qr-download.png");
  assert.deepEqual(
    readFileSync("/tmp/pace-leader-qr-download.png"),
    await renderParticipantQrPng("synthetic-selected-participant-opaque-token", { first_name: "Anna", last_name: "Bianchi", public_code: "FIXA" }),
  );
  console.log(
    "PASS actual downloaded PNG matches the selected participant token",
  );
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "/tmp/pace-leader-qr-desktop.png");
  ab("set", "viewport", "390", "844");
  check(
    'document.documentElement.scrollWidth <= innerWidth && document.querySelector("img[alt*=Anna]").getBoundingClientRect().width >= 180',
    "mobile QR fits and remains readable",
  );
  ab("screenshot", "/tmp/pace-leader-qr-mobile.png");
  for (const [state, label] of [
    ["revoked", "QR code revocato"],
    ["expired", "QR code scaduto"],
    ["unavailable", "QR code non disponibile"],
  ]) {
    ab("open", `${base}/leader-qr-check?state=${state}`);
    ab("snapshot", "-i");
    check(
      `!document.querySelector("img[alt*=Anna]") && !document.querySelector("a[download]") && document.querySelector("section button[disabled]") && document.body.innerText.includes(${JSON.stringify(label)})`,
      `${state}: explicit state without image or usable download`,
    );
  }
  check(
    '!document.querySelector("[data-nextjs-dialog]")',
    "no framework error overlay",
  );
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
}
