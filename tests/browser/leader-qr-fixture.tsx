import { LeaderParticipantQr } from "@/app/dashboard/capogruppo/participant-qr";
import { renderQrDataUrl } from "@/lib/qrcode/render";
import { renderParticipantQrDataUrl } from "@/lib/qrcode/participant-card";

export default async function Fixture({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const qrState =
    state === "revoked" || state === "expired" || state === "unavailable"
      ? state
      : "active";
  return (
    <main className="app-page">
      <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center modal-backdrop px-4 py-6">
        <div className="w-full max-w-5xl rounded-lg bg-white p-5">
          <h1 className="mb-4 text-xl font-semibold">Anna Bianchi · FIXA</h1>
          <LeaderParticipantQr
            participantName="Anna Bianchi"
            participantCode="FIXA"
            locale="it"
            qr={{
              state: qrState,
              dataUrl: qrState === "active" ? await renderQrDataUrl("synthetic-selected-participant-opaque-token") : null,
              downloadDataUrl:
                qrState === "active"
                  ? await renderParticipantQrDataUrl(
                      "synthetic-selected-participant-opaque-token",
                      { first_name: "Anna", last_name: "Bianchi", public_code: "FIXA" },
                    )
                  : null,
              expiresAt: qrState === "active" ? "2026-10-28T00:00:00Z" : null,
            }}
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              Nome
              <input className="field" defaultValue="Anna" />
            </label>
            <label>
              Email
              <input className="field" defaultValue="anna@example.test" />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
