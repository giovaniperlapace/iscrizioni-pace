import { deleteOperationalUserRole } from "@/app/actions";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";

type Assignment = {
  role: string;
  eventId: string | null;
  eventTitle: string | null;
  groupId: string | null;
  groupName: string | null;
};

const labels: Record<string, string> = {
  admin: "Admin globale",
  manager: "Manager",
  manager_viewer: "Manager viewer",
  accoglienza: "Accoglienza",
  capogruppo: "Capogruppo",
};

export function OperationalRoleRemoval({ userId, assignments, sourceDashboard, navMode }: {
  userId: string;
  assignments: Assignment[];
  sourceDashboard: "admin" | "manager";
  navMode: string;
}) {
  return (
    <section className="mt-6 border-t border-[var(--peace-border)] pt-5" aria-label="Rimozione ruoli">
      <h4 className="font-semibold">Ruoli attuali</h4>
      <p className="mt-2 text-sm text-[var(--peace-muted)]">
        Rimuovi solo l’incarico selezionato. Gli altri ruoli, l’account e l’iscrizione personale restano invariati.
        Non puoi rimuovere i tuoi ruoli.
      </p>
      <ul className="mt-4 grid gap-3">
        {assignments.filter((assignment) => labels[assignment.role]).map((assignment) => {
          const label = labels[assignment.role];
          const responsibility = [assignment.eventTitle, assignment.groupName].filter(Boolean).join(" · ") || "Tutti gli eventi";
          return (
            <li key={[assignment.role, assignment.eventId, assignment.groupId].join(":")} className="rounded-md border border-[var(--peace-border)] p-3">
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-1 break-words text-sm text-[var(--peace-muted)]">{responsibility}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[#8a3323]">Rimuovi ruolo</summary>
                <ReliableForm action={deleteOperationalUserRole} locale="it" className="mt-3 grid gap-3" data-preserve-dashboard-scroll>
                  <input type="hidden" name="sourceDashboard" value={sourceDashboard} />
                  <input type="hidden" name="nav" value={navMode} />
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="role" value={assignment.role} />
                  <input type="hidden" name="eventId" value={assignment.eventId ?? ""} />
                  <input type="hidden" name="groupId" value={assignment.groupId ?? ""} />
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="confirmRemoval" value="on" required className="mt-1" />
                    <span>Confermo la rimozione di {label} — {responsibility}.</span>
                  </label>
                  <PendingSubmitButton pendingLabel="Rimozione…" className="min-h-11 w-fit rounded-md border border-[#8a3323] px-4 text-sm font-semibold text-[#8a3323]">
                    Conferma rimozione
                  </PendingSubmitButton>
                </ReliableForm>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
