// Generate one-use test access without SMTP; keep links outside version control.
import fs from 'node:fs';
import QRCode from 'qrcode';
import {api} from './reception-staging-connection.mjs';
const emails=['accoglienza.staging@example.invalid','accoglienza2.staging@example.invalid','admin.accoglienza.staging@example.invalid'];
const email=process.argv[2]||emails[0];
if(!emails.includes(email)) throw Error('Only designated staging test accounts are allowed');
const base='https://iscrizioni-pace-git-codex-pan-f98a13-giovaniperlapaces-projects.vercel.app';
const result=await api('admin/generate_link',{type:'magiclink',email,redirect_to:`${base}/auth/callback`});
const token=result.hashed_token||result.properties?.hashed_token;
if(!token) throw Error('No hashed token returned');
const url=new URL('/auth/callback',base);
url.searchParams.set('token_hash',token);url.searchParams.set('type','magiclink');
url.searchParams.set('redirect_to',email.startsWith('admin.')?'/dashboard/admin':'/dashboard/accoglienza');
const dir='.env.collaudo-accoglienza';fs.mkdirSync(dir,{recursive:true,mode:0o700});
const image=await QRCode.toDataURL(url.href,{width:640,margin:4});
fs.writeFileSync(`${dir}/accesso-${email.split('@')[0]}.html`,`<!doctype html><meta charset="utf-8"><title>Accesso staging</title><style>body{font:20px system-ui;margin:40px;max-width:700px}img{width:360px}</style><h1>Accesso staging</h1><p>${email}</p><p>Generato: ${new Date().toISOString()}. Link temporaneo monouso. Inquadra con la fotocamera normale del telefono e apri nel browser.</p><img src="${image}"><p><a href="${url.href.replaceAll('&','&amp;')}">Apri accesso staging</a></p><p>Nessuna email inviata: modalità log. Non usare lo scanner accoglienza per questo QR di accesso.</p>`,{mode:0o600});
console.log(`Accesso preparato per ${email}; file locale privato, nessuna email inviata.`);
