"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Plus, ShieldCheck, X } from "lucide-react";
import { assignOperationalUserRole, deleteOperationalUserRole } from "@/app/actions";
import { OperationalRoleFields } from "@/app/dashboard/operational-role-fields";
import { ProgressButton } from "@/components/button-progress";
import { FORM_COPY } from "@/lib/forms/copy";
import type { FormFailure } from "@/lib/forms/result";

export type RoleAssignment = {
  role: string; eventId: string | null; eventTitle: string | null;
  groupId: string | null; groupName: string | null; isPrimaryGroupLeader: boolean | null;
};
type Person = { userId: string; fullName: string | null; email: string | null; assignments: RoleAssignment[] };
const labels: Record<string, string> = { admin: "Admin globale", manager: "Manager", manager_viewer: "Manager viewer", accoglienza: "Accoglienza", capogruppo: "Capogruppo" };
const keyOf = (a: RoleAssignment) => [a.role, a.eventId, a.groupId].join(":");
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold disabled:opacity-50";

export function OperationalRoleDialog({ person, eventOptions, groupOptions, sourceDashboard, navMode, actorUserId,
  assignAction = assignOperationalUserRole, removeAction = deleteOperationalUserRole,
}: {
  person: Person; eventOptions: Array<{ id: string; title: string }>;
  groupOptions: Array<{ id: string; eventId: string; name: string; eventTitle: string }>;
  sourceDashboard: "admin" | "manager"; navMode: string; actorUserId?: string;
  assignAction?: (data: FormData) => Promise<unknown>; removeAction?: (data: FormData) => Promise<unknown>;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const titleId = useId();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RoleAssignment | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const [removed, setRemoved] = useState<Record<string, RoleAssignment>>({});
  const [added, setAdded] = useState<Record<string, RoleAssignment>>({});
  const own = person.userId === actorUserId;
  useEffect(() => {
    const node = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); trigger?.focus({ preventScroll: true }); };
  }, []);
  const close = () => {
    if (busy.current) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("roleUserId");
    router.replace(url.pathname + url.search, { scroll: false });
  };
  const active = new Map(person.assignments.map(a => [keyOf(a), a]));
  Object.entries(added).forEach(([key, a]) => active.set(key, a));
  Object.keys(removed).forEach(key => active.delete(key));

  async function run(data: FormData, assignment?: RoleAssignment) {
    if (busy.current) return;
    const key = assignment ? keyOf(assignment) : "add";
    busy.current = true; setPending(key); setFeedback(null);
    data.set("inline", "on"); data.set("sourceDashboard", sourceDashboard); data.set("nav", navMode);
    try {
      const result = await (assignment ? removeAction : assignAction)(data);
      if (result && typeof result === "object" && "status" in result && result.status === "error") {
        const errors = (result as FormFailure).issues.map(issue => FORM_COPY.it[issue.code as keyof typeof FORM_COPY.it] ?? "Operazione non riuscita. Aggiorna la scheda e riprova.");
        setFeedback({ key, text: [...new Set(errors)].join(" "), error: true });
        return;
      }
      if (!result || typeof result !== "object" || !("status" in result) || result.status !== "success") throw new Error("Unexpected role response");
      if (assignment) {
        setRemoved(prev => ({ ...prev, [key]: assignment }));
        setAdded(prev => { const next = { ...prev }; delete next[key]; return next; });
        setConfirmation(null);
        if (editing && keyOf(editing) === key) { setEditing(null); setAdding(false); }
        addButton.current?.focus({ preventScroll: true });
      } else {
        const role = String(data.get("role"));
        const group = groupOptions.find(g => g.id === data.get("groupId"));
        const a: RoleAssignment = { role, eventId: role === "admin" ? null : String(data.get("eventId") || eventOptions[0]?.id || ""),
          eventTitle: role === "admin" ? null : eventOptions[0]?.title ?? null,
          groupId: role === "capogruppo" ? group?.id ?? null : null,
          groupName: role === "capogruppo" ? group?.name ?? null : null,
          isPrimaryGroupLeader: role === "capogruppo" ? data.get("leaderKind") === "primary" : null };
        if (group && role === "capogruppo") { a.eventTitle = group.eventTitle; a.eventId = group.eventId; }
        const addedKey = keyOf(a);
        setAdded(prev => ({ ...prev, [addedKey]: a }));
        setRemoved(prev => { const next = { ...prev }; delete next[addedKey]; return next; });
        setAdding(false);
      }
      setFeedback(assignment ? null : { key: "success", text: "Ruolo assegnato. Gli altri incarichi sono stati conservati.", error: false });
      router.refresh();
    } catch (error) {
      unstable_rethrow(error);
      setFeedback({ key, text: "Non è stato possibile verificare l’esito. Chiudi e riapri la scheda per controllare i ruoli prima di riprovare.", error: true });
    } finally { busy.current = false; setPending(null); }
  }
  const notice = (key: string) => feedback?.key === key ? <p role={feedback.error ? "alert" : "status"} className={`mt-3 rounded-md p-3 text-sm ${feedback.error ? "bg-[#fff3ef] text-[#8a3323]" : "bg-[var(--peace-sky-100)] text-[var(--peace-ink)]"}`}>{feedback.text}</p> : null;
  return <dialog ref={dialog} aria-labelledby={titleId} className="dashboard-modal fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-2xl backdrop:bg-[rgba(16,36,64,0.42)]"
    onCancel={event => { event.preventDefault(); if (busy.current) return; if (confirmation) setConfirmation(null); else if (adding) setAdding(false); else close(); }}>
    <div className="p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] pb-4">
        <h2 id={titleId} className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck size={21} aria-hidden />Gestisci ruoli</h2>
        <button type="button" aria-label="Chiudi gestione ruoli" disabled={!!pending} onClick={close} className={button}><X size={20} aria-hidden /></button>
      </header>
      <div className="my-5"><p className="font-semibold">{person.fullName || person.email}</p><p className="break-words text-sm text-[var(--peace-muted)]">{person.email}</p></div>
      <h3 className="font-semibold">Ruoli assegnati <span className="ml-2 text-sm text-[var(--peace-muted)]">{active.size}</span></h3>
      {own ? <p className="mt-2 text-sm text-[var(--peace-muted)]">Non puoi rimuovere i tuoi ruoli.</p> : null}
      {active.size === 0 ? <p className="mt-3 text-sm text-[var(--peace-muted)]">Nessun ruolo assegnato. Puoi aggiungerne uno qui sotto.</p> : null}
      <ul className="mt-3 grid gap-3">{[...active].map(([key, a]) => <li key={key} className="rounded-md border border-[var(--peace-border)] p-3">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 w-full sm:w-auto sm:flex-1"><p className="text-sm font-semibold">{labels[a.role] ?? a.role}{a.role === "capogruppo" ? <span className="ml-2 font-normal text-[var(--peace-muted)]">{a.isPrimaryGroupLeader ? "Principale" : "Secondario"}</span> : null}</p>
            <p className="mt-1 break-words text-sm text-[var(--peace-muted)]">{[a.eventTitle, a.groupName].filter(Boolean).join(" · ") || "Tutti gli eventi"}</p></div>
          {<div className="flex flex-wrap gap-2">{a.role === "capogruppo" ? <button type="button" disabled={!!pending} className={button} onClick={() => { setEditing(a); setAdding(true); setFeedback(null); }}>Modifica incarico</button> : null}<button type="button" className={`${button} text-[#8a3323]`} disabled={!!pending || own} onClick={() => { setConfirmation(key); setFeedback(null); }}>Rimuovi</button></div>}
        </div>
        {confirmation === key ? <form className="mt-3 border-t border-[var(--peace-border)] pt-3" aria-busy={pending === key} onSubmit={e => { e.preventDefault(); void run(new FormData(e.currentTarget), a); }}>
          <input type="hidden" name="userId" value={person.userId} /><input type="hidden" name="role" value={a.role} /><input type="hidden" name="eventId" value={a.eventId ?? ""} /><input type="hidden" name="groupId" value={a.groupId ?? ""} /><input type="hidden" name="confirmRemoval" value="on" />
          <p className="text-sm">Rimuovere questo incarico? Gli altri ruoli restano invariati.</p>{notice(key)}
          <div className="mt-3 flex flex-wrap justify-end gap-2"><button autoFocus type="button" className={button} disabled={!!pending} onClick={() => setConfirmation(null)}>Mantieni ruolo</button><ProgressButton type="submit" aria-busy={pending === key} progressError={feedback?.key === key && feedback.error} disabled={!!pending} className={`${button} border-[#8a3323] text-[#8a3323]`}>{pending === key ? "Rimozione…" : "Conferma rimozione"}</ProgressButton></div>
        </form> : null}
      </li>)}</ul>
      <section className="mt-5 border-t border-[var(--peace-border)] pt-5">
        <button ref={addButton} type="button" className={button} disabled={!!pending} aria-expanded={adding} onClick={() => { setEditing(null); setAdding(!adding); setFeedback(null); }}><Plus size={17} aria-hidden />Aggiungi ruolo</button>
        {adding ? <form key={editing ? keyOf(editing) : "add"} className="mt-4 grid gap-3" aria-busy={pending === "add"} onSubmit={e => { e.preventDefault(); void run(new FormData(e.currentTarget)); }}>
          <input type="hidden" name="mode" value="existing" /><input type="hidden" name="existingUserId" value={person.userId} />
          <fieldset disabled={!!pending}>
            <OperationalRoleFields eventOptions={eventOptions} groupOptions={editing ? groupOptions.filter(g => g.id === editing.groupId) : groupOptions.filter(g => ![...active.values()].some(a => a.groupId === g.id))} defaultGroupId={editing?.groupId} defaultLeaderKind={editing?.isPrimaryGroupLeader ? "primary" : "secondary"} roleOptions={Object.entries(labels).filter(([value]) => (sourceDashboard === "admin" || value !== "admin") && (!editing || value === "capogruppo")).map(([value, label]) => ({ value, label }))} defaultRole="capogruppo" />
          </fieldset>
          <p className="text-sm text-[var(--peace-muted)]">Il ruolo si aggiunge agli incarichi attuali. Manager e Manager viewer sono alternativi nello stesso evento.</p>
          {notice("add")}
          <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={!!pending} className={button} onClick={() => setAdding(false)}>Annulla</button><ProgressButton type="submit" aria-busy={pending === "add"} progressError={feedback?.key === "add" && feedback.error} disabled={!!pending} className={`${button} bg-[var(--peace-blue-800)] text-white`}>{pending === "add" ? "Salvataggio…" : editing ? "Salva incarico" : "Assegna ruolo"}</ProgressButton></div>
        </form> : null}
      </section>
      {notice("success")}
      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--peace-border)] pt-4"><p className="text-sm text-[var(--peace-muted)]">Account e iscrizione personale restano invariati.</p><button type="button" className={button} disabled={!!pending} onClick={close}>Chiudi</button></footer>
    </div>
  </dialog>;
}
