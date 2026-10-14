import { redirect } from "next/navigation";
import Link from "@/components/pending-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminReceptionPilot } from "@/lib/reception/admin-pilot.server";
import { renderQrLabelsHtml } from "@/lib/qrcode/print-label";
import { QR_LABEL_SAMPLES } from "@/lib/qrcode/print-samples";
import { CalibrationPanel } from "./panel";
export default async function Page() {
  if (!await isAdminReceptionPilot(await createSupabaseServerClient())) redirect("/dashboard");
  const documents = [];
  for (const profile of ["continuous-29x45", "die-cut-29x90"] as const) {
    for (const [index, sample] of QR_LABEL_SAMPLES.entries()) documents.push({ profile, id: String(index), name: `${sample.participant.first_name} ${sample.participant.last_name} · ${sample.participant.public_code}`, count: 1, html: await renderQrLabelsHtml([sample], profile) });
    documents.push({ profile, id: "batch", name: "Quattro persone, quattro QR diversi", count: QR_LABEL_SAMPLES.length, html: await renderQrLabelsHtml(QR_LABEL_SAMPLES, profile) });
  }
  return <main className="app-page"><div className="mx-auto grid max-w-4xl gap-5 px-5 py-8">
    <Link href="/dashboard/accoglienza" className="underline">Torna alla dashboard accoglienza</Link>
    <h1 className="text-2xl font-semibold text-[var(--peace-blue-800)]">Collaudo etichette QR · Admin</h1>
    <p>Solo campioni sintetici: nessuna iscrizione, QR, presenza o coda applicativa viene modificata. Questa pagina verifica la postazione e la carta; la coda condivisa si prova separatamente dalle schede Admin.</p>
    <CalibrationPanel documents={documents} />
  </div></main>;
}
