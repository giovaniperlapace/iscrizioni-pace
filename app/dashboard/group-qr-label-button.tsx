"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QrLabelPanel } from "./qr-label-panel";
export function GroupQrLabelButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.documentElement.style.overflow = previous; };
  }, [open]);
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  return <><button type="button" ref={trigger} className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]" onClick={() => setOpen(true)}>Stampa i QR del gruppo</button>
    {open ? createPortal(<dialog ref={dialog} aria-labelledby={title} onCancel={e => { e.preventDefault(); close(); }} onChange={e => e.stopPropagation()}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl bg-white p-5 text-left shadow-xl backdrop:bg-black/40">
      <header className="mb-4 flex items-start justify-between gap-4"><h2 id={title} className="text-xl font-semibold text-[var(--peace-blue-800)]">{groupName}</h2><button type="button" aria-label="Chiudi" className="min-h-11 min-w-11" onClick={close}>×</button></header>
      <QrLabelPanel scope={{ groupId }} />
    </dialog>, document.body) : null}</>;
}
