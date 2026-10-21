"use client";
import { useState } from "react";
import { ForumReceptionWorkstation } from "../workstation";
import { createForumReceptionDemo } from "@/lib/reception/forum-demo";
import { DEMO_DUTIES, DEMO_EVENT } from "@/lib/reception/demo-samples";

function Session() {
  const [demo]=useState(createForumReceptionDemo);
  return <ForumReceptionWorkstation eventId={DEMO_EVENT} choices={DEMO_DUTIES} canManage={false} requestAction={demo.request}/>;
}
export function ForumReceptionDemo() {
  const [revision,setRevision]=useState(0);
  return <>
    <section className="grid gap-3 rounded-xl border-2 border-amber-500 bg-amber-50 p-4" aria-label="Modalità prova">
      <strong>PROVA · Solo persone, Forum e posti fittizi</strong>
      <p>Le operazioni valgono soltanto in questa scheda del browser. Ogni telefono o computer ha una prova indipendente. Ricarica o premi Ricomincia per ripristinare tutti i casi.</p>
      <p>Apri i QR su un altro schermo o stampali. Qui scegli la postazione, poi Forum 1 per iniziare. I codici manuali F001–F009 funzionano solo in questa prova.</p>
      <div className="flex flex-wrap gap-4">
        <a href="/collaudo-forum-eventi/qr.html" target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-11 px-4">Apri i 9 QR di prova</a>
        <a href="/collaudo-forum-eventi/qr.html" download="qr-prova-forum-eventi.html" className="btn-secondary min-h-11 px-4">Scarica il foglio QR</a>
        <button className="btn-secondary min-h-11 px-4" onClick={()=>setRevision(value=>value+1)}>Ricomincia la prova</button>
      </div>
    </section>
    <Session key={revision}/>
  </>;
}
