"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import {
  COLUMNS,
  FORMAT_INSTRUCTIONS,
  FORMAT_VERSION,
} from "@/lib/data-quality/format";
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-lg bg-white p-0 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--peace-border)] px-5 py-3">
        <h2 id="import-participants-title" className="text-xl font-semibold">
          Importa iscritti da Excel
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Chiudi importazione"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md hover:bg-[var(--peace-sky-100)] focus-visible:outline-2"
        >
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="grid max-h-[calc(90dvh-5rem)] min-w-0 gap-5 overflow-y-auto p-5">
        <p className="text-sm text-[var(--peace-muted)]">
          Carica un file Excel e verifica l’anteprima prima di confermare
          l’importazione.
        </p>
        <a
          download
          href="/dashboard/participants/data-quality/api?kind=template"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)]"
        >
          <Download size={18} aria-hidden /> Scarica modello Excel vuoto
        </a>
        <details className="rounded-md border border-[var(--peace-border)] p-3">
          <summary className="cursor-pointer font-semibold">
            Istruzioni di importazione
          </summary>
          <div className="mt-3 grid gap-3 text-sm">
            <p>Formato {FORMAT_VERSION}</p>
            <ol className="list-decimal space-y-3 pl-6">
              {FORMAT_INSTRUCTIONS.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <h3 className="font-semibold">
              Intestazioni supportate, nell’ordine
            </h3>
            <p className="break-words font-mono text-xs">
              {COLUMNS.join(" · ")}
            </p>
          </div>
        </details>
        <ImportPanel />
      </div>
    </dialog>
  );
}
