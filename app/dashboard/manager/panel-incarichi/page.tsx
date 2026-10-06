import Link from "@/components/pending-link";
import { redirect } from "next/navigation";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PreserveDashboardScroll } from "@/app/dashboard/preserve-dashboard-scroll";
import { loadPanelAssignments, requirePanelManager } from "@/lib/reception/assignments.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { savePanelReceptionAssignment } from "./actions";

export default async function PanelAssignmentsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const db = await createSupabaseServerClient();
  const manager = await requirePanelManager(db);
  if (!manager) redirect("/dashboard");
  const { saved } = await searchParams;
  const service = createSupabaseServiceClient();
  const panels: { id: string; title: string; starts_at: string }[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await service.from("event_moments").select("id,title,starts_at")
      .eq("event_id", manager.event.id).eq("moment_type", "panel").order("id").range(from, from + 199);
    if (error || !data) throw new Error("Impossibile caricare i panel.");
    panels.push(...data);
    if (data.length < 200) break;
  }
  panels.sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.title.localeCompare(b.title));
  const assignments = await loadPanelAssignments(service, manager.event.id);
  const panelLabel = (id: string) => panels.find(panel => panel.id === id)?.title ?? "Panel non disponibile";
  return <main className="app-page text-[var(--peace-ink)]">
    <PreserveDashboardScroll />
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8">
      <Link href={`/dashboard/${manager.dashboard}?section=panel`} className="underline">Torna ai panel</Link>
      <header><h1 className="text-2xl font-semibold">Incarichi per panel e sala</h1>
        <p className="mt-2">Assegna a un account esistente uno o più panel. Gli altri incarichi della persona restano attivi.</p></header>
      {saved && ["assigned", "revoked"].includes(saved) && <p role="status" className="rounded-xl bg-green-50 p-4">{saved === "assigned" ? "Incarico assegnato." : "Incarico revocato."}</p>}
      <ReliableForm action={savePanelReceptionAssignment} locale="it" data-preserve-dashboard-scroll className="surface-card grid gap-4 p-5">
        <h2 className="text-lg font-semibold">Aggiungi incarico</h2>
        <input type="hidden" name="eventId" value={manager.event.id} /><input type="hidden" name="operation" value="assign" />
        <label className="grid gap-1">Email dell’account esistente<input type="email" name="email" required maxLength={320} className="field" /></label>
        <p className="text-sm text-[var(--peace-muted)]">Usa l’indirizzo con cui la persona accede al sito. L’assegnazione non invia email.</p>
        <label className="grid gap-1">Panel<select name="panelId" required defaultValue="" className="field">
          <option value="" disabled>Scegli un panel</option>{panels.map(panel => <option key={panel.id} value={panel.id}>{panel.title} · {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(panel.starts_at))}</option>)}
        </select></label>
        <label className="grid gap-1">Incarico<select name="duty" className="field"><option value="panel_entry">Ingresso al panel</option><option value="room_assistance">Assistenza in sala · sola consultazione</option></select></label>
        <PendingSubmitButton className="btn-primary min-h-12 px-4">Assegna incarico</PendingSubmitButton>
      </ReliableForm>
      <section className="grid gap-3"><h2 className="text-lg font-semibold">Incarichi assegnati</h2>
        {!assignments.length && <p>Nessun incarico panel assegnato.</p>}
        {assignments.map(item => <article key={item.id} className="surface-card grid gap-3 p-5">
          <h3 className="font-semibold">{item.name}</h3><p className="break-words text-sm">{item.email}</p>
          <p>{panelLabel(item.panelId)} · {item.duty === "panel_entry" ? "Ingresso al panel" : "Assistenza in sala"}</p>
          {item.userId === manager.userId ? <p className="text-sm">Per revocare il tuo incarico rivolgiti a un altro responsabile.</p> :
            <details><summary className="cursor-pointer py-2 font-semibold">Revoca incarico</summary>
              <ReliableForm action={savePanelReceptionAssignment} locale="it" data-preserve-dashboard-scroll className="grid gap-3">
                <input type="hidden" name="eventId" value={manager.event.id} /><input type="hidden" name="operation" value="revoke" />
                <input type="hidden" name="panelId" value={item.panelId} /><input type="hidden" name="userId" value={item.userId} /><input type="hidden" name="duty" value={item.duty} />
                <p>La persona perderà questo incarico sul panel. Gli altri incarichi resteranno invariati.</p>
                <PendingSubmitButton className="btn-secondary min-h-12 px-4">Conferma revoca</PendingSubmitButton>
              </ReliableForm>
            </details>}
        </article>)}
      </section>
    </section>
  </main>;
}
