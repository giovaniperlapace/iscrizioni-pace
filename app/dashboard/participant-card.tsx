import type { ReactNode } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { MANAGED_PARTICIPANT_COPY } from "@/lib/registrations/managed-participant-copy";

// Display only: each dashboard supplies its own authorized actions separately.
export function ParticipantCard({ qr, details, children }: { qr: ReactNode; details: ReactNode; children?: ReactNode }) {
  return <div data-testid="participant-card" className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
    <div className="mx-auto grid w-full max-w-72 gap-3 lg:mx-0">{qr}{children}</div>
    <div className="min-w-0">{details}</div>
  </div>;
}

export function ParticipantQr({ code, dataUrl, active, locale }: {
  code: string | null; dataUrl: string | null; active: boolean; locale: SupportedLocale;
}) {
  const copy = MANAGED_PARTICIPANT_COPY[locale];
  return <div className="relative grid gap-3 pt-3" data-testid="participant-qr">
    <span role="img" aria-label={active ? copy.active : copy.inactive} title={active ? copy.active : copy.inactive} className={`absolute right-0 top-0 size-3 rounded-full ${active ? "bg-green-600" : "bg-red-600"}`} />
    {dataUrl ? (
      // The PNG is generated server-side from the real opaque QR token.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={dataUrl} alt={copy.qr} width={240} height={240} className="mx-auto aspect-square w-full max-w-60 rounded-md border border-[var(--peace-border)] bg-white p-3" />
    ) : <p className="p-5 text-center text-sm text-[var(--peace-muted)]">{copy.unavailable}</p>}
    <p className="text-center text-sm">{copy.code}: <strong className="font-mono">{code ?? copy.missing}</strong></p>
    {dataUrl ? <a href={dataUrl} download={`qr-${code ?? "participant"}.png`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white">{copy.download}</a> : null}
  </div>;
}

export function ParticipantFacts({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{items.map(({ label, value }) =>
    <ParticipantFact key={label} label={label} value={value} />
  )}</dl>;
}

export function ParticipantFact({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-md border border-[var(--peace-border)] bg-[var(--peace-soft)] px-3 py-1.5 ${className}`}>
    <dt className="text-xs font-semibold uppercase tracking-wide text-[#6f7f91]">{label}</dt>
    <dd className="mt-0.5 break-words text-sm leading-5 text-[var(--peace-ink)]">{value}</dd>
  </div>;
}
