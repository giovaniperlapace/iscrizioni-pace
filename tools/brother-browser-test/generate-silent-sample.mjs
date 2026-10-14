// Synthetic-only fixture sharing the application's exact client and renderer.
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { renderQrLabelHtml } from '../../lib/qrcode/print-label.ts';
const dir = new URL('./', import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../../lib/qrcode/print-client.ts', dir), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
writeFileSync(new URL('print-client.js', dir), code);
const html = await renderQrLabelHtml('test_aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY3zA5bC', {
  first_name: 'José María', last_name: 'García López', public_code: 'TEST-003',
});
writeFileSync(new URL('silent-label-document.html', dir), html);
writeFileSync(new URL('silent-label-test.html', dir), `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prova stampa silenziosa · TEST-003</title><style>body{margin:0;background:#edf1f5;font-family:Arial,sans-serif;color:#111}main{max-width:700px;margin:40px auto;padding:28px;background:white;border-radius:12px}button{padding:14px 20px;font-size:16px;cursor:pointer;min-height:44px}p{line-height:1.5}</style></head><body><main><p>COLLAUDO LOCALE · SOLO DATI SINTETICI</p><h1>Stampa silenziosa dell’etichetta QR</h1><p><strong>José María García López · TEST-003</strong></p><p>Brother QL-810W · pretagliato 29 × 90 mm · contenuto 29 × 45 mm.</p><button id="print" type="button">Stampa etichetta QR</button><p id="status" role="status">Premi una volta: deve uscire una sola etichetta senza conferme nel dialogo.</p><p>Il QR sintetico è lo stesso dei campioni precedenti. Nessun accesso al database e nessuna presenza registrata.</p></main><script type="module">import {printQrLabel} from './print-client.js';const button=document.getElementById('print');const status=document.getElementById('status');let busy=false;button.addEventListener('click',async()=>{if(busy)return;busy=true;button.disabled=true;status.textContent='Avvio stampa…';try{await printQrLabel('./silent-label-document.html',new AbortController().signal);status.textContent='Comando di stampa avviato. Verifica l’etichetta fisica.';button.textContent='Ristampa etichetta QR';}catch{status.textContent='Impossibile avviare la stampa.';}finally{busy=false;button.disabled=false;}});</script></body></html>`);
console.log('Prova silenziosa pronta: silent-label-test.html');
