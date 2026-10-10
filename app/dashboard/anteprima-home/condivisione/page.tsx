import Link from "next/link";
import { loadAllRows } from "@/lib/supabase/all-rows";
import { CreatePreviewShareForm } from "./create-form";
import { revokePreviewShare } from "./actions";
import { requirePreviewShareAdmin } from "@/lib/panels/home-preview-share.server";
import { PendingSubmitButton } from "@/components/pending-submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Condivisione anteprima", robots: { index: false, follow: false } };

export default async function PreviewShares() {
  const { db, eventId } = await requirePreviewShareAdmin();
  const { data: shares } = await loadAllRows<{ id: string; label: string; expires_at: string; revoked_at: string | null }>((from, to) => db.from("home_preview_shares").select("id,label,expires_at,revoked_at").eq("event_id", eventId).order("created_at", { ascending: false }).order("id").range(from, to));
  return <main className="app-container grid gap-6 py-10">
    <Link href="/dashboard/anteprima-home" className="font-semibold underline">Torna all’anteprima</Link>
    <h1 className="text-3xl font-bold text-[var(--peace-blue-900)]">Condividi l’anteprima</h1>
    <p className="max-w-3xl leading-7">Chi ha il link può vedere l’anteprima senza login. Non può accedere al gestionale o inviare iscrizioni. Ogni link dura 30 giorni e può essere revocato qui in qualsiasi momento.</p>
    <CreatePreviewShareForm />
    <ul className="grid gap-4">{shares.map(share => {
      const active = !share.revoked_at && Date.parse(share.expires_at) > new Date().getTime();
      return <li key={share.id} className="surface-card flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="font-bold">{share.label}</h2><p className="mt-2 text-sm">{share.revoked_at ? "Revocato" : active ? "Attivo" : "Scaduto"} · Scadenza {new Date(share.expires_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</p></div>{active ? <form action={revokePreviewShare}><input type="hidden" name="shareId" value={share.id} /><PendingSubmitButton pendingLabel="Revoca…" className="btn-secondary px-5 py-3">Revoca link</PendingSubmitButton></form> : null}</li>;
    })}</ul>
  </main>;
}
