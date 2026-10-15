// Mac only, operator-driven. Does not change printer defaults or the 12 October profile.
import { mkdirSync, readFileSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import { chromeLabelProfileErrors } from '../../lib/qrcode/chrome-print-profile.ts';
const options=new Map();const calibrating=process.argv.includes('--calibrate');
for(const arg of process.argv.slice(2)){
 if(arg==='--calibrate'||arg==='--hardware-confirmed')continue;
 const match=arg.match(/^--(profile|printer|driver-paper|chrome-paper-id|mac-custom-paper|url|loaded-roll)=(.+)$/);
 if(!match)throw Error('Argomento non riconosciuto. Usare il runbook di collaudo.');options.set(match[1],match[2]);
}
if(process.platform!=='darwin')throw Error('Launcher per macOS. Windows richiede un collaudo separato.');
const profile=options.get('profile'),printer=options.get('printer'),driverPaper=options.get('driver-paper');
if(!['continuous-29x45','die-cut-29x90'].includes(profile)||!printer||!driverPaper||!process.argv.includes('--hardware-confirmed'))throw Error('Confermare hardware, profilo, nome coda e formato reale del driver.');
if(options.get('loaded-roll')!==(profile==='continuous-29x45'?'DK-22210':'DK-11201'))throw Error('Consumabile caricato non confermato per questo profilo.');
const url=new URL(options.get('url'));
if((url.protocol!=='https:' && !(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))||url.username||url.password||url.search||url.hash)throw Error('Usare URL applicativo senza credenziali o parametri.');
const capabilities=execFileSync('lpoptions',['-p',printer,'-l'],{encoding:'utf8'});
const sizes=capabilities.split('\n').find(line=>line.startsWith('PageSize/'))?.split(':')[1]?.trim().split(/\s+/).map(x=>x.replace(/^\*/,''))??[];
if(!sizes.includes(driverPaper))throw Error('Formato non esposto dal driver della coda selezionata. Calibrare prima la carta personalizzata nel driver.');
const root=path.join(os.homedir(),'Library','Application Support','iscrizioni-pace-print',profile);
mkdirSync(root,{recursive:true,mode:0o700});
try{lstatSync(path.join(root,'SingletonLock'));throw Error('Chiudere il Chrome dedicato prima di cambiare modalità.');}catch(error){if(error.code!=='ENOENT')throw error;}
if(!calibrating){
 const preferences=JSON.parse(readFileSync(path.join(root,'Default','Preferences'),'utf8'));
 const state=JSON.parse(preferences.printing?.print_preview_sticky_settings?.appState??'{}');
 let customPaper;
 if(options.has('mac-custom-paper')){
  if(options.has('chrome-paper-id')||driverPaper!=='Custom.WIDTHxHEIGHT')throw Error('Usare un solo tipo di carta verificata.');
  const papers=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',path.join(os.homedir(),'Library','Preferences','com.apple.print.custompapers.plist')],{encoding:'utf8'}));
  const paper=papers[options.get('mac-custom-paper')];
  if(!paper||paper.custom!==true||paper.name!==options.get('mac-custom-paper')||[paper.top,paper.bottom,paper.left,paper.right].some(x=>x!==0))throw Error('Formato personalizzato macOS o margini non verificati.');
  customPaper={name:paper.name,widthPoints:paper.width,heightPoints:paper.height};
 }
 const problems=chromeLabelProfileErrors(state,profile,printer,options.get('chrome-paper-id')??'',customPaper);
 const defaults=execFileSync('lpoptions',['-p',printer],{encoding:'utf8'});
 if(!/(?:^|\s)CutMedia=EndOfPage(?:\s|$)/.test(defaults))problems.push('Taglio dopo ogni pagina non verificato nelle opzioni Brother');
 if(problems.length)throw Error('Stampa silenziosa bloccata: '+problems.join('; '));
}
// LaunchServices gives this separate Chrome instance a visible foreground
// window. Spawning the executable directly can leave it running unseen.
execFileSync('/usr/bin/open',['-n','-a','/Applications/Google Chrome.app','--args',
 `--user-data-dir=${root}`,...(calibrating?[]:['--kiosk-printing']),'--no-first-run','--no-default-browser-check','--new-window',url.href,
],{stdio:['ignore','pipe','pipe']});
console.log(calibrating?'Avvio del Chrome dedicato per calibrazione richiesto, senza invio automatico.':'Avvio del Chrome dedicato silenzioso richiesto, nessuna stampa inviata.');
console.log('Il rotolo caricato e il risultato fisico richiedono conferma dell’operatore. Il vecchio profilo pretagliato è conservato.');
