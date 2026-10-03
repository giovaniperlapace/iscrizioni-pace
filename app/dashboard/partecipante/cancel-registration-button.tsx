"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, TriangleAlert, UserRoundX } from "lucide-react";
import { ProgressButton } from "@/components/button-progress";
import { cancelOwnRegistration } from "./cancellation-actions";
import type { SupportedLocale } from "@/lib/i18n/config";
import { SELF_CANCELLATION_COPY } from "@/lib/registrations/self-cancellation-copy";

export function CancelRegistrationButton({ registrationId, locale }: { registrationId: string; locale: SupportedLocale }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"failed" | "session" | null>(null);
  const copy = SELF_CANCELLATION_COPY[locale];
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  function close() {
    if (busy.current) return;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  async function cancel() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await cancelOwnRegistration(registrationId, true);
      if (result.error) setError(result.error);
      else {
        router.replace("/dashboard/partecipante?cancelled=1", { scroll: false });
        router.refresh();
        return;
      }
    } catch { setError("failed"); }
    busy.current = false;
    setPending(false);
  }
  return <>
    <button ref={trigger} type="button" onClick={() => { setError(null); setOpen(true); }}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2">
      <UserRoundX size={18} aria-hidden="true" />{copy.title}
    </button>
    {open ? createPortal(<dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm sm:p-6">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-red-50 text-red-700"><TriangleAlert size={24} aria-hidden="true" /></div>
      <h2 id={titleId} className="text-xl font-semibold">{copy.title}</h2>
      <div id={descriptionId} className="mt-3 grid gap-3 text-sm leading-6">
        <p className="font-semibold">{copy.intro}</p><p>{copy.impact}</p>
        <p className="text-[var(--peace-muted)]">{copy.history}</p>
        <div className="flex gap-3 rounded-xl bg-[var(--peace-sky-100)] p-4 text-[var(--peace-blue-800)]"><Info className="mt-1 shrink-0" size={18} aria-hidden="true" /><p>{copy.again}</p></div>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{copy[error]}</p> : null}
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" autoFocus disabled={pending} onClick={close} className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm disabled:opacity-50"><ArrowLeft size={18} aria-hidden="true" />{copy.keep}</button>
        <ProgressButton progressError={!!error} type="button" disabled={pending} aria-busy={pending} onClick={() => void cancel()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
          <UserRoundX size={18} aria-hidden="true" />{pending ? copy.pending : copy.confirm}
        </ProgressButton>
      </div>
    </dialog>, document.body) : null}
  </>;
}
