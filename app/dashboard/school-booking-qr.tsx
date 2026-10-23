"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function SchoolBookingQr({bookingId}: {bookingId:string}) {
  const [dataUrl,setDataUrl] = useState<string | null>(null);
  const [busy,setBusy] = useState(false);
  const [failed,setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => {active.current?.abort(); active.current=null;},[bookingId]);
  async function load() {
    if (active.current) return;
    const controller = new AbortController(); active.current=controller;
    setBusy(true); setFailed(false);
    const timer = setTimeout(()=>controller.abort(),20000);
    try {
      const response = await fetch(`/api/school-booking-qr?bookingId=${encodeURIComponent(bookingId)}`,{cache:"no-store",signal:controller.signal});
      const body = await response.json();
      if (!response.ok || typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:image/png;base64,")) throw new Error("QR unavailable");
      if (active.current===controller) setDataUrl(body.dataUrl);
    } catch { if (active.current===controller) setFailed(true); }
    finally { clearTimeout(timer); if (active.current===controller) {active.current=null;setBusy(false);} }
  }
  return <section aria-label="QR della prenotazione scuola" className="grid justify-items-start gap-3 rounded-lg border border-[var(--peace-border)] p-4">
    <h3 className="font-semibold">QR della classe</h3>
    <p className="text-sm text-[var(--peace-muted)]">Un solo QR per accoglienza e Forum prenotati. L’operatore inserisce il numero di studenti e accompagnatori realmente presenti.</p>
    {dataUrl ? <><Image src={dataUrl} alt="QR della prenotazione scuola" width={200} height={200} unoptimized/><a className="btn-secondary min-h-11 px-4" href={dataUrl} download={`qr-scuola-${bookingId.slice(0,8)}.png`}>Scarica QR</a></> : <button type="button" className="btn-secondary min-h-11 px-4" disabled={busy} onClick={()=>void load()}>{busy ? "Caricamento QR…" : failed ? "Riprova" : "Visualizza QR"}</button>}
    {failed && <p role="alert" className="text-sm text-red-800">QR non disponibile. Riprova o contatta l’organizzazione.</p>}
  </section>;
}
