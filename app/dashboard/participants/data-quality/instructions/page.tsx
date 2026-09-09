import Link from "next/link";
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
      <a
        download
        className="btn-secondary inline-flex w-fit items-center px-4 py-2 text-sm"
        href="/dashboard/participants/data-quality/api?kind=template"
      >
        Scarica il modello Excel
      </a>
      <ImportInstructions />
    </main>
  );
}
