"use client";

export default function DashboardLoadError({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto my-8 max-w-xl space-y-4 rounded-xl border border-[var(--peace-border)] bg-white p-6" role="alert">
      <h1 className="text-xl font-semibold">Dati temporaneamente non disponibili</h1>
      <p>Non è stato possibile caricare tutti i dati. Riprova per visualizzare un riepilogo completo.</p>
      <button type="button" className="btn-primary px-4 py-2" onClick={reset}>Riprova</button>
    </section>
  );
}
