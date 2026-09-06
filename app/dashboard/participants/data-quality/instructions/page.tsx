import Link from "next/link";
import { qualityAccess } from "@/lib/data-quality/access.server";
import {
  COLUMNS,
  FORMAT_INSTRUCTIONS,
  FORMAT_VERSION,
} from "@/lib/data-quality/format";
export default async function ImportInstructionsPage() {
  await qualityAccess();
  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 py-8">
      <Link className="underline" href="/dashboard/participants/data-quality">
        ← Importa iscritti da Excel
      </Link>
      <h1 className="text-2xl font-bold">Come importare gli iscritti</h1>
      <p>Formato {FORMAT_VERSION}</p>
      <a
        download
        className="underline"
        href="/dashboard/participants/data-quality/api?kind=template"
      >
        Scarica modello Excel vuoto, esempi e cataloghi
      </a>
      <ol className="list-decimal space-y-4 pl-6">
        {FORMAT_INSTRUCTIONS.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ol>
      <h2 className="text-xl font-semibold">
        Intestazioni supportate, nell’ordine
      </h2>
      <p className="break-words font-mono text-sm">{COLUMNS.join(" · ")}</p>
      <h2 className="text-xl font-semibold">Unione consapevole</h2>
      <p>
        Scegli la scheda da conservare. Nome, cognome e valori già presenti
        hanno precedenza; i dati mancanti sono completati dall’altra scheda. I
        tag vengono riuniti; gruppo e servizio vengono recuperati solo se
        assenti. Le scelte di presenza già presenti prevalgono.
      </p>
      <p>
        Il secondo record viene archiviato con un collegamento al primo; il suo
        QR è revocato e le email in attesa vengono escluse. Consensi,
        questionari, storico e audit rimangono nella scheda originaria. Il
        record unito non può essere ripristinato dalla normale azione di
        ripristino.
      </p>
      <p>
        Conserva la scheda collegata all’account. Due account distinti,
        iscrizioni della stessa identità ad altri eventi o una scheda da
        archiviare con minori, check-in, prenotazioni di momenti o bisogni di
        accessibilità richiedono una riconciliazione dedicata prima del merge.
        Il sistema annulla integralmente l’operazione in questi casi.
      </p>
    </main>
  );
}
