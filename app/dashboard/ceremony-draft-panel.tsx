"use client";
import { useEffect, useRef, useState } from "react";
import type { SeatsDesk } from "@/lib/ceremonies/seats-desk";
import {
  draftData,
  type CeremonyDraft,
  type DraftCommand,
  type DraftResult,
} from "@/lib/ceremonies/drafts";
import { SECTOR_MESSAGES } from "@/lib/ceremonies/sector-desk";

import { CeremonyPublicationReport } from "./ceremony-publication-report";

function DraftRow({
  draft,
  desk,
  disabled,
  run,
}: {
  draft: CeremonyDraft;
  desk: SeatsDesk;
  disabled: boolean;
  run: (
    operation: "save" | "remove",
    draft: CeremonyDraft,
    sector?: string,
    quantity?: number,
  ) => void;
}) {
  const [sector, setSector] = useState(draft.sectorId);
  const [quantity, setQuantity] = useState(draft.quantity);
  const name =
    draft.action === "group_nominal"
      ? `${draft.groupName} · ${draft.quantity} nomi`
      : draft.subjects.length
        ? draft.subjects.map((s) => s.name).join(", ")
        : draft.groupName;
  return (
    <li className="grid min-w-0 gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <p className="break-words">
        <strong>{name}</strong> · {draft.quantity} posti · Settore{" "}
        {draft.sector} · Bozza
      </p>
      {draft.action === "group_nominal" && (
        <details>
          <summary className="cursor-pointer text-sm underline">
            Persone selezionate
          </summary>
          <ul className="max-h-48 overflow-y-auto pl-4 text-sm">
            {draft.subjects.map((s) => (
              <li key={s.childId ?? s.registrationId}>
                {s.name}
                {s.childId ? " · Minore" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Sposta nel settore
          <select
            className="field"
            aria-label={`Settore bozza ${name}`}
            value={sector}
            disabled={disabled}
            onChange={(e) => setSector(e.target.value)}
          >
            {desk.sectors
              .filter((s) => !s.numbered)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        {draft.groupId && !draft.subjects.length && (
          <label className="grid gap-1 text-sm">
            Posti in bozza
            <input
              className="field w-28"
              aria-label={`Posti in bozza ${name}`}
              type="number"
              min={1}
              max={10000}
              value={quantity}
              disabled={disabled}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        )}
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          disabled={
            disabled ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            (sector === draft.sectorId && quantity === draft.quantity)
          }
          onClick={() => run("save", draft, sector, quantity)}
        >
          Salva modifica
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          aria-label={`Rimuovi bozza ${name}`}
          disabled={disabled}
          onClick={() => run("remove", draft)}
        >
          Rimuovi bozza
        </button>
      </div>
    </li>
  );
}
export function CeremonyDraftPanel({
  desk,
  sectorId,
  disabled,
  execute,
  onBusy,
  onSaved,
}: {
  desk: SeatsDesk;
  sectorId?: string;
  disabled: boolean;
  execute: (c: DraftCommand) => Promise<DraftResult>;
  onBusy: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<DraftCommand | null>(null);
  const [pending, setPending] = useState<DraftCommand | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  const drafts = (desk.drafts ?? []).filter(
    (d) => !sectorId || d.sectorId === sectorId,
  );
  const total = drafts.reduce((n, d) => n + d.quantity, 0);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
  }, [confirmation]);
  function close() {
    dialog.current?.close();
    setConfirmation(null);
    trigger.current?.focus({ preventScroll: true });
  }
  async function run(command: DraftCommand) {
    if (active.current) return;
    active.current = true;
    setWorking(true);
    onBusy(true);
    setMessage("");
    let result: DraftResult;
    try {
      result = await execute(command);
    } catch {
      result = { status: "unavailable" };
    }
    if (result.status === "unavailable") {
      setPending(command);
      setMessage(
        "Esito non verificabile. Riprova la stessa richiesta: non verranno duplicati posti o notifiche.",
      );
    } else {
      setPending(null);
      if (result.status === "saved" && command.operation === "publish")
        setReportOpen(true);
      setMessage(
        result.status === "saved"
          ? command.operation === "publish"
            ? `${result.seats} posti pubblicati. ${result.notifications} notifiche accodate; la consegna non è ancora confermata.${result.missingGroups ? ` Attenzione: ${result.missingGroups} gruppi non hanno un capogruppo da avvisare.` : ""}`
            : command.operation === "remove"
              ? "Bozza rimossa."
              : "Bozza aggiornata."
          : result.status === "empty"
            ? "Non ci sono bozze da pubblicare."
            : (SECTOR_MESSAGES[result.status] ?? "Operazione non riuscita."),
      );
      close();
      try {
        await onSaved();
      } finally {
        onBusy(false);
      }
    }
    active.current = false;
    setWorking(false);
  }
  function edit(
    operation: "save" | "remove",
    draft: CeremonyDraft,
    sector?: string,
    quantity?: number,
  ) {
    void run({
      planId: desk.planId,
      revision: desk.revision,
      requestId: crypto.randomUUID(),
      operation,
      draftId: draft.id,
      data: operation === "save" ? draftData(draft, sector, quantity) : null,
    });
  }
  const retry = (
    <button
      type="button"
      className="btn-primary px-4 py-2"
      disabled={working}
      onClick={() => pending && void run(pending)}
    >
      Riprova la stessa richiesta
    </button>
  );
  return (
    <section
      className={
        sectorId ? "grid gap-3 border-t pt-4" : "surface-card grid gap-3 p-4"
      }
      aria-label={sectorId ? "Bozze del settore" : "Bozze e pubblicazione"}
    >
      <h3 className="font-semibold">
        {total} posti in bozza{sectorId ? " nel settore" : ""}
      </h3>
      {!sectorId && (
        <>
          <p className="text-sm">
            Le bozze sono condivise tra Admin e Manager. Puoi spostarle,
            cambiare le quantità dei gruppi o rimuoverle. Non sono visibili a
            partecipanti e capigruppo.
          </p>
          <p className="text-sm">
            Pubblicando tutte le bozze di questa cerimonia, i posti diventano
            visibili nelle dashboard. Per le quantità assegnate al gruppo, ogni
            capogruppo coinvolto riceve un’email per abbinarle alle proprie
            persone; i destinatari nominali ricevono il settore assegnato. Per i
            minori viene usato il contatto dell’adulto.
          </p>
          <button
            type="button"
            ref={trigger}
            className="btn-primary w-fit px-4 py-2"
            disabled={disabled || working || !!pending || !drafts.length}
            onClick={() => {
              setMessage("");
              setConfirmation({
                planId: desk.planId,
                revision: desk.revision,
                requestId: crypto.randomUUID(),
                operation: "publish",
                draftId: null,
                data: null,
              });
            }}
          >
            Conferma posti e invia notifica ai partecipanti
          </button>
          {Object.keys(desk.notifications ?? {}).length > 0 && (
            <p className="text-sm" aria-label="Stato notifiche">
              Email: {desk.notifications?.queued ?? 0} in coda ·{" "}
              {desk.notifications?.sending ?? 0} in elaborazione ·{" "}
              {desk.notifications?.accepted ?? 0} accettate dal servizio di
              invio · {desk.notifications?.failed ?? 0} fallite ·{" "}
              {desk.notifications?.uncertain ?? 0} con esito incerto ·{" "}
              {desk.notifications?.skipped ?? 0} non inviate. Usa Aggiorna
              disponibilità per rileggere gli esiti.
            </p>
          )}
        </>
      )}
      {!sectorId && (
        <>
          <button
            type="button"
            className="btn-secondary w-fit px-4 py-2"
            aria-expanded={reportOpen}
            onClick={() => setReportOpen((v) => !v)}
          >
            {reportOpen
              ? "Chiudi report invii"
              : "Report invii delle pubblicazioni"}
          </button>
          {reportOpen && (
            <CeremonyPublicationReport
              planId={desk.planId}
              revision={desk.revision}
            />
          )}
        </>
      )}
      {message && !confirmation && <p role="status">{message}</p>}
      {pending && !confirmation && retry}
      {drafts.length > 0 && (
        <details open={!!sectorId}>
          <summary className="cursor-pointer text-sm underline">
            Rivedi e modifica le bozze
          </summary>
          <ul className="mt-3 grid gap-3">
            {drafts.map((d) => (
              <DraftRow
                key={`${d.id}-${desk.revision}`}
                draft={d}
                desk={desk}
                disabled={disabled || working || !!pending}
                run={edit}
              />
            ))}
          </ul>
        </details>
      )}
      {confirmation && (
        <dialog
          ref={dialog}
          aria-labelledby="publish-drafts-title"
          onCancel={(e) => {
            e.preventDefault();
            if (!working && !pending) close();
          }}
          className="fixed inset-0 m-auto max-h-[85dvh] w-[min(36rem,calc(100%-2rem))] space-y-4 overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-black/50"
        >
          <h2 id="publish-drafts-title" className="text-xl font-semibold">
            Pubblicare i posti in bozza?
          </h2>
          <p>
            {desk.kind === "opening" ? "Inaugurazione" : "Cerimonia finale"}:{" "}
            {total} posti. La pubblicazione rende visibili le assegnazioni e
            accoda le email ai destinatari e ai capigruppo coinvolti.
          </p>
          <ul className="list-disc pl-5">
            {drafts.map((d) => (
              <li key={d.id}>
                {d.subjects.length
                  ? d.subjects.map((s) => s.name).join(", ")
                  : d.groupName}{" "}
                · Settore {d.sector} · {d.quantity} posti ·{" "}
                {d.subjects.length
                  ? "Nominali: notifica ai partecipanti"
                  : "Gruppo: abbinamento del capogruppo"}
              </li>
            ))}
          </ul>
          {message && <p role="alert">{message}</p>}
          <div className="flex flex-wrap gap-3">
            {pending ? (
              retry
            ) : (
              <button
                type="button"
                className="btn-primary px-4 py-2"
                disabled={working}
                onClick={() => void run(confirmation)}
              >
                Conferma pubblicazione e notifiche
              </button>
            )}
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              disabled={working || !!pending}
              onClick={close}
            >
              Annulla
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
