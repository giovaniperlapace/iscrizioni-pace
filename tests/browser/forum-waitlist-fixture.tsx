import { ParticipantPanelBookings, type ParticipantPanelCatalogRow } from "@/app/dashboard/partecipante/participant-panel-bookings";
import { PublicPanelProgram } from "@/app/public-panel-program";
import { getMessages } from "@/lib/i18n/messages";
import { normalizeLocale } from "@/lib/i18n/config";
export const fixtureRegistrationId = "11111111-1111-4111-8111-111111111112";
export const fixtureRows: ParticipantPanelCatalogRow[] = ["available", "full", "queued", "offered", "conflict", "selected"].map((booking_status, i) => ({
  panel_id: `11111111-1111-4111-8111-${String(i+1).padStart(12,"0")}`, section_id: `section-${i}`,
  audience_name: "Iscritti", title: `Forum sintetico ${i+1}`, description: null,
  starts_at: "2026-10-26T16:00:00+01:00", ends_at: "2026-10-26T18:00:00+01:00",
  location_name: "Sala sintetica", location_address: null, booking_status: booking_status as ParticipantPanelCatalogRow["booking_status"], party_size: 1,
  offer_expires_at: booking_status === "offered" ? "2026-10-26T15:30:00+01:00" : null, queue_position: booking_status === "queued" ? 2 : null,
}));
export default async function Fixture({ searchParams }: { searchParams: Promise<{ locale?: string; view?: string }> }) {
  const { locale: value, view } = await searchParams;
  const locale = normalizeLocale(value) ?? "it";
  if (view === "home") return <PublicPanelProgram locale={locale} bookingsOpen copy={getMessages(locale).panelProgram}
    panels={fixtureRows.slice(0,2).map(row => ({ id: row.panel_id, title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at, locationName: row.location_name, locationAddress: null, availability: row.booking_status === "full" ? "full" : "available" }))} />;
  return <main className="mx-auto w-full max-w-6xl p-5"><ParticipantPanelBookings locale={locale} registrationId={fixtureRegistrationId} rows={fixtureRows} /></main>;
}
