type ConfirmationProps = {
  searchParams: Promise<{
    email?: string;
  }>;
};

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#1c241f]">
      <section className="mx-auto max-w-3xl rounded-lg border border-[#d8dece] bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
          Iscrizione ricevuta
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Grazie</h1>
        <p className="mt-4 leading-7 text-[#4b5a50]">
          Abbiamo registrato la tua iscrizione e inviato una conferma a{" "}
          <strong>{params.email ?? "la tua email"}</strong>. Per rientrare
          nella dashboard usa la stessa email dalla home.
        </p>
      </section>
    </main>
  );
}
