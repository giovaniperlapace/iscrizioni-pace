"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, FileSpreadsheet, X } from "lucide-react";
import { ImportInstructions } from "./import-instructions";
import { ImportPanel } from "./panels";

export default function ImportParticipantsDialog({
  closePath,
}: {
  closePath: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const close = () => router.replace(closePath, { scroll: false });
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document
        .getElementById("import-participants-trigger")
        ?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="import-participants-title"
      aria-describedby="import-participants-description"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-[var(--shadow-soft)] backdrop:bg-[rgba(16,36,60,0.52)] open:flex"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--peace-border)] bg-[var(--peace-soft)] p-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="hidden rounded-xl bg-[var(--peace-sky-100)] p-3 text-[var(--peace-blue-800)] sm:block">
            <FileSpreadsheet size={24} aria-hidden />
          </span>
          <div>
            <h2 id="import-participants-title" className="text-xl font-bold text-[var(--peace-blue-900)]">
              Importa iscritti da Excel
            </h2>
            <p id="import-participants-description" className="mt-1 text-sm text-[var(--peace-muted)]">
              Prepara il file, controlla l’anteprima e conferma le nuove iscrizioni.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Chiudi importazione"
          className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white"
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="grid min-h-0 min-w-0 gap-6 overflow-y-auto p-5 sm:p-6">
        <section aria-labelledby="import-prepare-title" className="grid gap-3">
          <h3 id="import-prepare-title" className="font-semibold text-[var(--peace-blue-900)]">
            1. Prepara il file
          </h3>
          <p className="text-sm leading-relaxed text-[var(--peace-muted)]">
            Usa il modello e compila il foglio Partecipanti, una persona per riga.
            Trovi anche un esempio e gli elenchi di gruppi, servizi e tag disponibili.
          </p>
          <a
            download
            href="/dashboard/participants/data-quality/api?kind=template"
            className="btn-secondary inline-flex w-fit items-center gap-2 px-4 py-2 text-sm"
          >
            <Download size={18} aria-hidden /> Scarica modello Excel
          </a>
          <details className="group surface-panel">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-[var(--peace-blue-800)] [&::-webkit-details-marker]:hidden">
              Come compilare il modello
              <ChevronDown size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--peace-border)] p-4">
              <ImportInstructions />
            </div>
          </details>
        </section>
        <ImportPanel />
      </div>
    </dialog>
  );
}
