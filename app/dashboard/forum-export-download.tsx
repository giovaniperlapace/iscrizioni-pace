"use client";

import { useRef } from "react";
import { Download, FileText, X } from "lucide-react";
import { PendingDownload } from "@/components/pending-download";
import { FORUM_EXPORT_SESSIONS } from "@/lib/panels/roster-export-sessions";

export function ForumExportDownload({ eventId }: { eventId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <article className="mb-6 grid gap-3 rounded-lg border border-[var(--peace-border)] p-5">
    <h3 className="flex items-center gap-3 font-bold"><FileText aria-hidden="true" className="h-6 w-6 text-[var(--peace-blue-800)]" />Elenchi Forum in PDF</h3>
    <p className="text-sm leading-6 text-[var(--peace-muted)]">Scarica uno ZIP con un PDF per ogni Forum della sessione, comprese le sale collegate. Ogni elenco distingue iscritti confermati e lista d’attesa, inclusi i minori selezionati.</p>
    <button type="button" className="btn-secondary inline-flex w-fit items-center gap-2 px-4 py-2 text-sm" onClick={() => dialog.current?.showModal()}><Download className="h-4 w-4" aria-hidden="true" />Scarica PDF Forum</button>
    <dialog ref={dialog} aria-labelledby="forum-export-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-[var(--peace-border)] bg-white p-6 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40">
      <div className="flex items-start justify-between gap-4"><h3 id="forum-export-title" className="text-lg font-bold">Scegli la sessione</h3><button type="button" aria-label="Chiudi" className="btn-secondary p-2" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <p className="my-4 text-sm text-[var(--peace-muted)]">Seleziona la sessione per scaricare il file ZIP con gli elenchi PDF.</p>
      <div className="grid gap-3">{FORUM_EXPORT_SESSIONS.map(session => <div key={session.key} className="grid gap-2">
        <PendingDownload href={`/dashboard/manager/esportazioni/forum?event=${encodeURIComponent(eventId)}&session=${session.key}`} filename={`forum-${session.key}.zip`} contentType="application/zip" className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"><Download size={16} aria-hidden="true" />{session.label}</PendingDownload>
      </div>)}</div>
    </dialog>
  </article>;
}
