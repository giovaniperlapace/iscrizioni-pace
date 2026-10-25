// Deterministic synthetic QR assets. No credentials, database or network.
import {mkdirSync,writeFileSync} from 'node:fs';
import QRCode from 'qrcode';
import {DEMO_SAMPLES} from '../lib/reception/demo-samples.ts';
const directory='tests/fixtures/collaudo-forum-eventi';
mkdirSync(directory,{recursive:true});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=[];
for(const sample of DEMO_SAMPLES){
 const image=await QRCode.toBuffer(sample.token,{type:'png',width:640,margin:4,errorCorrectionLevel:'M'});
 writeFileSync(`${directory}/${sample.code}.png`,image);
 cards.push(`<article><h2>${sample.code} · ${escape(sample.scenario)}</h2><p class="name">${escape(sample.name)} Prova${sample.child?' + Luca Prova':''}</p><img width="240" height="240" src="data:image/png;base64,${image.toString('base64')}" alt="QR di prova ${sample.code}"><p>${escape(sample.instruction)}</p></article>`);
}
writeFileSync(`${directory}/qr.html`,`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>9 QR fittizi · Accoglienza forum ed eventi</title><style>
*{box-sizing:border-box}body{font:16px/1.45 system-ui,sans-serif;color:#14314d;background:#f3f7fb;max-width:1200px;margin:auto;padding:24px}h1{font-size:28px;margin:0 0 10px}header{margin-bottom:24px}header p{max-width:80ch}a,button{color:#064c85}button{font:inherit;padding:10px 18px;cursor:pointer}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}article{background:white;border:1px solid #bdcddb;border-radius:12px;padding:16px;break-inside:avoid}h2{font-size:18px;margin:0}.name{margin:5px 0}img{display:block;max-width:100%;height:auto;margin:0 auto}article p:last-child{margin:5px 0 0;font-size:14px}footer{margin:24px 0}.actions{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
@page{size:A4;margin:10mm}@media print{body{background:white;padding:0;font-size:9pt}h1{font-size:16pt}header{margin:0 0 4mm}header p{margin:2mm 0;max-width:none}.actions,footer{display:none}main{grid-template-columns:repeat(3,1fr);gap:3mm}article{padding:2mm;border-radius:2mm}h2{font-size:10pt}.name{font-size:9pt}img{width:40mm;height:40mm}article p:last-child{font-size:8pt;line-height:1.25}}
</style></head><body><header><h1>QR fittizi · Accoglienza forum ed eventi</h1><p><strong>Solo per la pagina “Prova con QR fittizi”.</strong> Non identificano partecipanti reali. Apri la prova sul telefono e scansiona questi QR da un altro schermo o dal foglio stampato. Puoi anche inserire i codici F001–F009 al computer.</p><p>Le operazioni sono indipendenti su ogni dispositivo e si azzerano con “Ricomincia la prova” o ricaricando la pagina.</p><div class="actions"><a href="/test-forum-demo">Apri la pagina di prova</a><button type="button" onclick="window.print()">Stampa il foglio</button></div></header><main>${cards.join('')}</main><footer>Tutti i nomi, i Forum, i biglietti e le sedi sono fittizi. Nessun posto reale viene prenotato.</footer></body></html>`);
console.log(`Generated ${DEMO_SAMPLES.length} synthetic PNG QR codes and self-contained printable HTML.`);
