"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { UsbScannerBuffer } from "@/lib/reception/usb-scanner";

export function ReceptionUsbScanner({ paused, readOnly = false, onCode }: { paused: boolean; readOnly?: boolean; onCode: (code: string) => void }) {
  const target = useRef<HTMLDivElement>(null);
  const [buffer] = useState(() => new UsbScannerBuffer());
  const receive = useEffectEvent((code: string) => { if (!paused) onCode(code); });
  useEffect(() => {
    buffer.clear();
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) { buffer.clear(); return; }
      const element = event.target instanceof HTMLElement ? event.target : null;
      const editable = element?.matches("input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]");
      const packet = buffer.key(event.key, performance.now());
      // Do not steal ordinary keyboard entry in school count fields. A scanner
      // terminator is still swallowed so it cannot submit a presence form.
      if (packet.consumed && (!editable || event.key === "Enter")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (packet.code && !editable) receive(packet.code);
    };
    const clear = () => buffer.clear();
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      buffer.clear();
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [paused, buffer]);
  useEffect(() => {
    if (paused) return;
    const focus = () => target.current?.focus({ preventScroll: true });
    focus();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [paused]);
  return <div ref={target} tabIndex={0} className="grid gap-2 rounded-xl border border-[var(--peace-border)] bg-slate-50 p-4 outline-offset-4" aria-label="Scanner USB">
    <p role="status" className="font-semibold">{paused ? "Lettura sospesa · completa la scheda aperta" : "Scanner USB pronto · leggi un QR code"}</p>
    <p className="text-sm">{readOnly ? "Usa il lettore collegato a questo computer per verificare iscrizione e ritiro del badge. Nessuna presenza viene modificata." : "Usa il lettore collegato a questo computer. La lettura apre la scheda; presenza e stampa si confermano dai rispettivi pulsanti."}</p>
  </div>;
}
