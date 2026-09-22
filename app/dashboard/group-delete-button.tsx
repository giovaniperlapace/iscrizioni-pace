"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { manageGroupDeletion } from "@/app/dashboard/groups/actions";
import { GROUP_DELETION_COPY } from "@/lib/groups/deletion-copy";
import { type SupportedLocale } from "@/lib/i18n/config";
import type { GroupDeletionError, GroupDeletionPreview } from "@/lib/groups/deletion";

export function GroupDeleteButton({ groupId, groupName, locale }: { groupId: string; groupName: string; locale: SupportedLocale }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<GroupDeletionPreview | null>(null);
  const [error, setError] = useState<GroupDeletionError | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const copy = GROUP_DELETION_COPY[locale];
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  function close() {
    if (busy.current) return;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  async function run(remove = false) {
    if (busy.current || (remove && (!preview || !confirmed))) return;
    busy.current = true;
    setPending(true); setError(null); setConfirmed(false);
    if (!remove) setPreview(null);
    try {
      const result = await manageGroupDeletion(groupId, remove ? preview!.expected : undefined);
      if ("error" in result) { setError(result.error); setPreview(null); }
      else if ("preview" in result) setPreview(result.preview);
      else {
        setDeleted(true);
        const url = new URL(window.location.href);
        url.searchParams.set("groupDeleted", "1");
        router.replace(url.pathname + url.search, { scroll: false });
        router.refresh();
      }
    } catch { setError("failed"); setPreview(null); }
    finally { busy.current = false; setPending(false); }
  }
  const blocked = !!preview && preview.children > 0;
  return <>
    <button ref={trigger} type="button" onClick={() => { setOpen(true); void run(); }}
      aria-label={`${copy.delete}: ${groupName}`}
      className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50">{copy.delete}</button>
    {open ? createPortal(<dialog ref={dialog} aria-labelledby={titleId}
      onChange={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-5 text-left text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40">
      <h2 id={titleId} className="text-xl font-semibold">{deleted ? copy.deleted : copy.title}</h2>
      <p className="mt-2 break-words font-semibold">{preview?.name ?? groupName}</p>
      {pending ? <p role="status" className="mt-4" aria-live="polite">{copy.loading}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{copy[error]}</p> : null}
      {preview && !deleted ? <>
        <dl className="my-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
          {([['children', 'childrenLabel'], ['currentAssignments', 'currentLabel'], ['assignments', 'assignmentsLabel'], ['memberships', 'membershipsLabel'], ['links', 'linksLabel'], ['rules', 'rulesLabel']] as const).map(([key, label]) =>
            <div key={key} className="contents"><dt>{copy[label]}</dt><dd className="font-semibold">{preview[key]}</dd></div>)}
        </dl>
        {preview.children > 0 ? <p className="mt-3 text-sm text-red-800">{copy.children}</p> : null}
        {!blocked ? <><p className="mt-3 text-sm leading-6">{copy.impact}</p>
          <label className="mt-4 flex items-start gap-3 text-sm font-semibold"><input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />{copy.confirm}</label></> : null}
      </> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={close} className="min-h-11 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold disabled:opacity-50">{deleted ? copy.close : copy.cancel}</button>
        {error || blocked ? <button type="button" disabled={pending} onClick={() => void run()} className="min-h-11 rounded-md border px-4 text-sm font-semibold disabled:opacity-50">{copy.reload}</button> : null}
        {preview && !blocked && !deleted ? <button type="button" disabled={!confirmed || pending} aria-busy={pending} onClick={() => void run(true)} className="min-h-11 rounded-md bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{copy.delete}</button> : null}
      </div>
    </dialog>, document.body) : null}
  </>;
}

export function GroupDeletionNotice({ locale }: { locale: SupportedLocale }) {
  const params = useSearchParams();
  return params.get("groupDeleted") === "1" ? <p role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{GROUP_DELETION_COPY[locale].deleted}</p> : null;
}
