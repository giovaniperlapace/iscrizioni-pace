import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import QRCode from "qrcode";
import type { QrParticipantIdentity } from "./participant-card.ts";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

import { QR_LABEL_PROFILES, type QrLabelProfile } from "./print-label-profile.ts";
export { QR_LABEL_PROFILES, isQrLabelProfile, type QrLabelProfile } from "./print-label-profile.ts";

// The dialog is voluntary. Neither print() nor afterprint confirms a physical label.
const printScript = `const button=document.getElementById('print');const images=[...document.images];Promise.all(images.map(image=>image.decode())).then(()=>{button.disabled=false;}).catch(()=>{document.getElementById('notice').textContent='Immagine non disponibile. Chiudi e riapri l’anteprima.';});button.addEventListener('click',()=>window.print());`;
export const QR_LABEL_CSP = `default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'sha256-${createHash("sha256").update(printScript).digest("base64")}'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`;

export async function renderQrLabelHtml(token: string, participant: QrParticipantIdentity, profile: QrLabelProfile = "die-cut-29x90"): Promise<string> {
  const { height, codeTop } = QR_LABEL_PROFILES[profile];
  const firstName = participant.first_name.replace(/\s+/g, " ").trim();
  const lastName = participant.last_name.replace(/\s+/g, " ").trim();
  if (!firstName || !lastName) throw new Error("QR label identity missing");
  const name = `${firstName} ${lastName}`;
  // Rasterize the full name using the bundled font: no font substitution at print time.
  // Word/character wrapping at a bounded, physically measured font size. Never truncate.
  const dpi = 300;
  const pixelsPerMm = dpi / 25.4;
  let nameImage: { data: Buffer; info: { width: number; height: number } } | undefined;
  for (const points of [9, 8, 7]) {
    const result = await sharp({ text: {
      text: `${escapeHtml(firstName)}\n${escapeHtml(lastName)}`,
      font: `Noto Sans ${points}`, fontfile: path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf"),
      dpi, width: Math.floor(25 * pixelsPerMm), align: "centre", wrap: "word-char", rgba: true,
    } }).png().toBuffer({ resolveWithObject: true });
    if (result.info.height <= Math.floor(12 * pixelsPerMm)) { nameImage = result; break; }
  }
  if (!nameImage) throw new Error("Full name does not fit QR label");
  const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  // Six 300-dpi dots per module reproduces the physically tested version-4 sample.
  const dots = Math.min(6, Math.floor(22 * pixelsPerMm / (modules + 8)));
  if (dots < 4) throw new Error("QR label payload too dense");
  const qrMm = (modules + 8) * dots / pixelsPerMm;
  let cells = "";
  for (let y = 0; y < modules; y++) for (let x = 0; x < modules; x++) {
    if (qr.modules.get(y, x)) cells += `M${x + 4} ${y + 4}h1v1h-1z`;
  }
  const code = participant.public_code ?? "";
  const codeImage = code ? await sharp({ text: {
    text: escapeHtml(code), font: "Noto Sans 8",
    fontfile: path.join(process.cwd(), "lib/qrcode/fonts/NotoSans-Regular.ttf"), dpi, rgba: true,
  } }).png().toBuffer({ resolveWithObject: true }) : null;
  if (codeImage && (codeImage.info.width > 25 * pixelsPerMm || codeImage.info.height > 4 * pixelsPerMm)) {
    throw new Error("QR label code does not fit");
  }
  const codeWidth = (codeImage?.info.width ?? 0) / pixelsPerMm;
  const codeHeight = (codeImage?.info.height ?? 0) / pixelsPerMm;
  const imageWidth = nameImage.info.width / pixelsPerMm;
  const imageHeight = nameImage.info.height / pixelsPerMm;
  return `<!doctype html><html lang="it" data-qr-label="29x${height}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Etichetta QR · ${escapeHtml(name)}</title><style>
@page{size:29mm ${height}mm;margin:0}*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#111;font-family:Arial,sans-serif}main{max-width:700px;margin:24px auto;padding:24px;background:white;border-radius:12px}h1{font-size:22px}p,li{line-height:1.5}button{min-height:44px;padding:12px 18px;font-size:16px;cursor:pointer}.paper{position:relative;width:29mm;height:${height}mm;background:white;margin:24px auto;box-shadow:0 0 0 1px #aaa;break-inside:avoid}.name{position:absolute;left:${(29 - imageWidth) / 2}mm;top:3.5mm;width:${imageWidth}mm;height:${imageHeight}mm}.qr{position:absolute;left:${(29 - qrMm) / 2}mm;top:16mm;width:${qrMm}mm;height:${qrMm}mm;display:block}.code{position:absolute;left:${(29 - codeWidth) / 2}mm;top:${codeTop}mm;width:${codeWidth}mm;height:${codeHeight}mm}.marks{position:absolute;inset:0;width:29mm;height:${height}mm}@media print{html,body{width:29mm;margin:0;padding:0;background:white}main{display:none}.paper{height:${height - 1}mm;overflow:hidden;margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main><h1>Stampa etichetta QR · 29 × 45 mm</h1><p>${escapeHtml(name)}${code ? ` · ${escapeHtml(code)}` : ""}</p>${height === 90 ? '<p>Supporto: <strong>29 × 90 mm pretagliato</strong>. Ritaglia manualmente a 45 mm seguendo i riferimenti.</p>' : '<p>Supporto: <strong>continuo da 29 mm</strong>, pagina 29 × 45 mm. Usare solo dopo verifica del rotolo e calibrazione del formato reale nel driver.</p>'}<ol><li>Brother QL-810W: una copia, formato 29 × ${height} mm, verticale.</li><li>Scala 100%, margini Nessuno, intestazioni e piè di pagina disattivati. Verifica una sola pagina.</li><li>Taglio a fine pagina da ${height} mm.</li></ol><button id="print" type="button" disabled>Apri dialogo di stampa</button><p id="notice">La stampa usa il QR esistente e non registra presenze. Verifica l’etichetta fisica: la chiusura del dialogo non conferma la stampa. Riapri l’anteprima per rileggere i dati prima di una nuova stampa.</p></main><article class="paper" aria-label="Etichetta di ${escapeHtml(name)}"><img class="name" src="data:image/png;base64,${nameImage.data.toString("base64")}" alt="${escapeHtml(name)}"><svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules + 8} ${modules + 8}" role="img" aria-label="QR personale" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${cells}" fill="black"/></svg>${codeImage ? `<img class="code" src="data:image/png;base64,${codeImage.data.toString("base64")}" alt="${escapeHtml(code)}">` : ""}${height === 90 ? `<svg class="marks" viewBox="0 0 29 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 45h2 M24 45h2" stroke="black" stroke-width="0.15" fill="none"/></svg>` : ""}</article><script>${printScript}</script></body></html>`;
}


// Render all labels before claiming a shared queue attempt. No partial document.
export async function renderQrLabelsHtml(labels: { token: string; participant: QrParticipantIdentity }[], profile: QrLabelProfile): Promise<string> {
  if (!labels.length || labels.length > 10000) throw new Error("Invalid label count");
  let first = "";
  const articles: string[] = [];
  const rules: string[] = [];
  for (const [index, label] of labels.entries()) {
    const html = await renderQrLabelHtml(label.token, label.participant, profile);
    if (!first) first = html;
    let article = html.match(/<article[\s\S]*?<\/article>/)![0];
    for (const cls of ["name", "qr", "code"]) {
      const rule = html.match(new RegExp(`\\.${cls}\\{[^}]+\\}`))![0];
      rules.push(rule.replace(`.${cls}{`, `.${cls}-${index}{`));
      article = article.replace(`class="${cls}"`, `class="${cls}-${index}"`);
    }
    articles.push(article);
  }
  return first.replace(/<title>.*?<\/title>/, "<title>Etichette QR</title>")
    .replace("</style>", `${rules.join("")}@media print{.paper{break-after:page}.paper:last-of-type{break-after:auto}}</style>`)
    .replace(/<article[\s\S]*?<\/article>/, articles.join(""))
    .replace(/<main>[\s\S]*?<\/main>/, `<main><h1>Etichette QR</h1><p>${labels.length} etichette · una pagina per QR. Una copia, tutte le pagine, scala 100%, margini Nessuno, nessuna intestazione, taglio dopo ogni pagina.</p><button id="print" disabled>Apri dialogo di stampa</button><p id="notice">Verifica fisicamente ogni etichetta. La stampa non registra presenze.</p></main>`);
}
