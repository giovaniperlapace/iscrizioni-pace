// Solo dati sintetici. Eseguire dalla root: node tools/brother-browser-test/generate.mjs
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const payload = 'test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC';
const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
const n = qr.modules.size, moduleMm = 6 * 25.4 / 300;
const total = (n + 8) * moduleMm;
let cells = '';
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y,x)) cells += `M${x+4} ${y+4}h1v1h-1z`;
const metadata = { sample:'BROWSER-29x45-v1', payload, bytes:Buffer.byteLength(payload), generator:'qrcode 1.5.4', ecc:'M', version:qr.version, modules:n, moduleMm, blackMm:n*moduleMm, quietZoneMm:4*moduleMm, totalMm:total, paperMm:[29,90], cropMm:[29,45] };
const html = `<!doctype html>
<html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brother — BROWSER-29x45-v1</title>
<style>
@page { size:29mm 90mm; margin:0; }
*{box-sizing:border-box}body{margin:0;background:#edf1f5;font-family:Arial,sans-serif;color:#111}
main{max-width:860px;margin:28px auto;padding:24px;background:white;border-radius:12px}h1{font-size:24px}p,li{line-height:1.5}code{overflow-wrap:anywhere}button{padding:12px 18px;font-size:16px;cursor:pointer}
.paper{position:relative;width:29mm;height:90mm;background:white;margin:24px auto;box-shadow:0 0 0 1px #aaa;break-inside:avoid}
.name{position:absolute;left:2mm;top:3.5mm;width:25mm;text-align:center;font-size:9pt;line-height:11pt;white-space:pre}
.qr{position:absolute;left:${(29-total)/2}mm;top:16mm;width:${total}mm;height:${total}mm;display:block}
.code{position:absolute;left:2mm;top:40mm;width:25mm;text-align:center;font-size:8pt;line-height:10pt}
.marks{position:absolute;left:0;top:0;width:29mm;height:90mm}
@media print{html,body{width:29mm;margin:0;padding:0;background:white}main{display:none}.paper{height:89mm;overflow:hidden;margin:0;box-shadow:none;border:0;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
<main><h1>Prova Brother · 29 × 45 mm</h1><p>Campione <b>BROWSER-29x45-v1</b> · solo dati sintetici · nessun collegamento all’app o al database.</p>
<p><b>Supporto caricato: DK-11201, 29 × 90 mm.</b> Il campione occupa i primi 45 mm. I due piccoli riferimenti laterali indicano il ritaglio manuale. La linea nella parte da scartare misura 20 mm.</p>
<ol><li>Brother QL-810W, una copia, formato fisico 29 × 90 mm, verticale.</li><li>Scala 100%, margini Nessuno, intestazioni e piè di pagina disattivati. Verificare una sola pagina.</li><li>Taglio solo a fine etichetta/pagina da 90 mm. Mai impostare 45 mm sul pretagliato.</li></ol>
<p>Nome: Arial 9 pt, tre righe; codice 8 pt. QR versione ${qr.version}, ECC M, ${n} × ${n} moduli; nero ${metadata.blackMm.toFixed(3)} mm, modulo ${moduleMm.toFixed(3)} mm, bordo bianco ${metadata.quietZoneMm.toFixed(3)} mm su ogni lato (4 moduli), totale ${total.toFixed(3)} mm.</p>
<p>Payload atteso (43 caratteri): <code>${payload}</code></p>
<button onclick="window.print()">Apri dialogo di stampa</button><p>La chiusura del dialogo non conferma la stampa. Misure, uscita, taglio e scansione vanno verificati sull’etichetta fisica.</p>
</main>
<div class="paper" aria-label="Etichetta sintetica José María García López TEST-001">
<div class="name">José María\nGarcía\nLópez</div>
<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}" role="img" aria-label="QR sintetico di prova" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${cells}" fill="black"/></svg>
<div class="code">TEST-001</div>
<svg class="marks" viewBox="0 0 29 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 45h2 M24 45h2 M4.5 59v2 M4.5 60h20 M24.5 59v2" stroke="black" stroke-width="0.15" fill="none"/><text x="14.5" y="64" text-anchor="middle" font-family="Arial" font-size="2.5">20 mm · v1</text></svg>
</div></html>`;
const dir = fileURLToPath(new URL('.',import.meta.url));
writeFileSync(dir+'index.html',html);
writeFileSync(dir+'sample.json',JSON.stringify(metadata,null,2)+'\n');
console.log(metadata);
