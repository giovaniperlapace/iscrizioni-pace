import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import QRCode from "qrcode";
import { renderParticipantQrPng } from "../lib/qrcode/participant-card.ts";

const token = "synthetic-selected-participant-opaque-token";
test("card preserves QR pixels and quiet zone exactly; identity is outside the payload", async () => {
  const rawQr = await QRCode.toBuffer(token, { errorCorrectionLevel: "M", margin: 4, scale: 12, type: "png" });
  const { width = 0, height = 0 } = await sharp(rawQr).metadata();
  for (const name of ["Anna Bianchi", "Éléonore D’Ávila", "Олександра Ковальчук", "Maria Alessandra " .repeat(12), "A<&> B"]) {
    const card = await renderParticipantQrPng(token, { first_name: name, last_name: "Rossi", public_code: "PACE-1234" });
    const meta = await sharp(card).metadata();
    assert.ok(meta.height! > height + 80);
    const qrPixels = await sharp(card).extract({ left: Math.floor((meta.width! - width) / 2), top: 16, width, height }).removeAlpha().raw().toBuffer();
    assert.deepEqual(qrPixels, await sharp(rawQr).removeAlpha().raw().toBuffer());
    const caption = await sharp(card).extract({ left: 0, top: height + 32, width: meta.width!, height: meta.height! - height - 32 }).removeAlpha().raw().toBuffer();
    assert.ok(caption.some(value => value < 100), "name/code must be rasterized into the PNG");
  }
});
test("missing name cannot produce an anonymous downloadable card", async () => {
  await assert.rejects(renderParticipantQrPng(token, { first_name: "", last_name: " ", public_code: "PACE-1234" }), /name missing/);
});
