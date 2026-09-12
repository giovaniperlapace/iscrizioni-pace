import { PendingDownload } from "@/components/pending-download";
import Link from "@/components/pending-link";
import { qualityAccess } from "@/lib/data-quality/access.server";
import { ImportInstructions } from "../import-instructions";
export default async function ImportInstructionsPage() {
  await qualityAccess();
  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 py-8">
      <Link className="underline" href="/dashboard/participants/data-quality">
        ← Importa iscritti da Excel
      </Link>
      <h1 className="text-2xl font-bold">Come importare gli iscritti</h1>
      <PendingDownload
        filename="modello-partecipanti.xlsx"
        className="btn-secondary inline-flex w-fit items-center px-4 py-2 text-sm"
        href="/dashboard/participants/data-quality/api?kind=template"
      >
        Scarica il modello Excel
      </PendingDownload>
      <ImportInstructions />
    </main>
  );
}
