import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import jsQR from "jsqr";
import { renderQrLabelHtml, QR_LABEL_CSP } from "../lib/qrcode/print-label.ts";
import { createHash } from "node:crypto";

const token = "test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC";
test("print label retains the existing opaque payload, four modules and calibrated physical geometry", async () => {
  const html = await renderQrLabelHtml(token, { first_name: "José María", last_name: "García López", public_code: "TEST-001" });
  assert.ok(html.includes("size:29mm 90mm"));
  assert.match(html, /M3 45h2 M24 45h2/);
  const svg = html.match(/<svg class="qr".*?<\/svg>/)![0].replace('class="qr"', 'width="492" height="492"');
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.equal(decoded?.data, token);
  assert.ok(!html.includes(token), "Raw credentials do not appear in document metadata/text");
  const size = Number(html.match(/\.qr\{[^}]*width:([\d.]+)mm/)![1]);
  assert.ok(Math.abs(size - 20.828) < 0.001);
  const nameHeight = Number(html.match(/\.name\{[^}]*height:([\d.]+)mm/)![1]);
  assert.ok(nameHeight <= 12);
  const script = html.match(/<script>(.*?)<\/script>/)![1];
  assert.ok(QR_LABEL_CSP.includes(createHash("sha256").update(script).digest("base64")));
  assert.ok(!script.includes("afterprint") && !script.includes("fetch("));
});

test("international names are complete and HTML is escaped; excessive names/density fail closed", async () => {
  for (const [first_name, last_name] of [
    ["Ada", "Mori"], ["Alessandra Francesca", "Monteverdi"], ["Олександр", "Шевченко"],
    ["A<&", 'B"\''],
  ]) {
    const html = await renderQrLabelHtml(token, { first_name, last_name, public_code: null });
    assert.ok(html.includes("data:image/png;base64,"));
    assert.ok(!html.includes("A<&"));
  }
  await assert.rejects(renderQrLabelHtml(token, { first_name: "Alessandra ".repeat(50), last_name: "Monteverdi", public_code: "TEST-001" }), /does not fit/);
  await assert.rejects(renderQrLabelHtml("x".repeat(2000), { first_name: "Ada", last_name: "Mori", public_code: null }), /dense/);
});
