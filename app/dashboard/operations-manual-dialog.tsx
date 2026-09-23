"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export function OperationsManualDialog({ closePath, closeLabel, title, eventTitle, children }: {
  closePath: string;
  closeLabel: string;
  title: string;
  eventTitle: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.getElementById("manual-participant-trigger")?.focus({ preventScroll: true });
    };
  }, []);
  const close = () => {
    if (ref.current?.querySelector('form[aria-busy="true"]')) return;
    window.history.replaceState(null, "", closePath);
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-[var(--shadow-soft)] backdrop:bg-[rgba(16,36,60,0.52)] open:flex"
      onCancel={event => { event.preventDefault(); close(); }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--peace-border)] bg-[var(--peace-soft)] p-5 sm:px-6">
        <div>
          <h2 id={titleId} className="text-xl font-bold text-[var(--peace-blue-900)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">{eventTitle}</p>
        </div>
        <button type="button" onClick={close} aria-label={closeLabel}
          className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white">
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="grid min-h-0 min-w-0 gap-5 overflow-y-auto p-5 sm:p-6">{children}</div>
    </dialog>
  );
}
