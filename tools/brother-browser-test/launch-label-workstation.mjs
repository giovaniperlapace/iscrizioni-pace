// Mac only, operator-driven. Does not change printer defaults or the 12 October profile.
import { mkdirSync, readFileSync, lstatSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import os from 'node:os';import path from 'node:path';
import { chromeLabelProfileErrors } from '../../lib/qrcode/chrome-print-profile.ts';
const options=new Map();const calibrating=process.argv.includes('--calibrate');
for(const arg of process.argv.slice(2)){
 if(arg==='--calibrate'||arg==='--hardware-confirmed')continue;
 const match=arg.match(/^--(profile|printer|driver-paper|chrome-paper-id|url|loaded-roll)=(.+)$/);
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
 const problems=chromeLabelProfileErrors(state,profile,printer,options.get('chrome-paper-id'));
 const defaults=execFileSync('lpoptions',['-p',printer],{encoding:'utf8'});
 if(!/(?:^|\s)CutMedia=EndOfPage(?:\s|$)/.test(defaults))problems.push('Taglio dopo ogni pagina non verificato nelle opzioni Brother');
 if(problems.length)throw Error('Stampa silenziosa bloccata: '+problems.join('; '));
}
const child=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
 `--user-data-dir=${root}`,...(calibrating?[]:['--kiosk-printing']),'--no-first-run','--no-default-browser-check',`--app=${url.href}`,
],{detached:true,stdio:'ignore'});child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.unref();
console.log(calibrating?'Chrome dedicato aperto per calibrazione, senza invio automatico.':'Chrome dedicato aperto in modalità silenziosa, nessuna stampa inviata.');
console.log('Il rotolo caricato e il risultato fisico richiedono conferma dell’operatore. Il vecchio profilo pretagliato è conservato.');
