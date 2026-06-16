import { redirect } from "next/navigation";

import { updateEventOpeningState } from "@/app/actions";
import { PersonalRegistrationCard } from "@/app/dashboard/personal-registration-card";
import { getCurrentAuthContext } from "@/lib/auth/session";
import {
  getOpeningState,
  openingStateLabel,
  summarizeRegistrationMonitoring,
  type RegistrationMonitoringInput,
  type RegistrationMonitoringSummary,
} from "@/lib/registrations/opening-monitoring";
import { getPersonalRegistrationSummary } from "@/lib/registrations/personal-registration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type AdminPageProps = {
  searchParams: Promise<{
    openingError?: string;
    openingSaved?: string;
  }>;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  city: string | null;
  country: string | null;
  starts_on: string | null;
  ends_on: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
};

type RegistrationRow = {
  id: string;
  participant_id: string;
  status: string | null;
  submitted_at: string | null;
};

type AssignmentRow = {
  registration_id: string;
  status: string | null;
  source: string | null;
  is_current: boolean | null;
  assignment_reason: string | null;
};

type QrTokenRow = {
  registration_id: string;
};

type AccessibilityRow = {
  registration_id: string;
  needs_operational_support: boolean | null;
};

type ContactRow = {
  participant_id: string;
  email: string | null;
};

type EventSnapshot = {
  event: EventRow;
  openingState: ReturnType<typeof getOpeningState>;
  summary: RegistrationMonitoringSummary;
  emailErrorsLast24Hours: number;
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "admin");

  if (!auth) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const [{ data: roles }, personalRegistration, snapshots] = await Promise.all([
    supabase
      .from("event_user_roles")
      .select("role,event_id")
      .order("created_at", { ascending: false }),
    getPersonalRegistrationSummary(supabase, auth.user.id),
    getOpeningSnapshots(),
  ]);
  const totalRegistrations = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.summary.total,
    0
  );
  const openEvents = snapshots.filter(
    (snapshot) => snapshot.openingState === "open"
  ).length;
  const watchItems = snapshots.reduce(
    (sum, snapshot) =>
      sum +
      snapshot.summary.withoutCurrentGroup +
      snapshot.summary.missingQrToken +
      snapshot.emailErrorsLast24Hours,
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area protetta
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Dashboard admin</h1>
          <p className="mt-3 max-w-3xl text-[#4b5a50]">
            Accesso verificato per {auth.user.email}. Controlla apertura,
            iscrizioni e segnali iniziali senza esporre dati personali.
          </p>
        </header>

        <StatusMessage
          error={params.openingError}
          saved={params.openingSaved}
        />

        <section className="grid gap-4 sm:grid-cols-4">
          <Metric label="Ruolo dashboard" value={auth.dashboardRole} />
          <Metric label="Eventi aperti" value={String(openEvents)} />
          <Metric label="Iscrizioni totali" value={String(totalRegistrations)} />
          <Metric label="Da controllare" value={String(watchItems)} />
        </section>

        <PersonalRegistrationCard summary={personalRegistration} />

        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">Apertura e monitoraggio</h2>
            <p className="mt-1 text-sm leading-6 text-[#5e6d63]">
              Usa questi comandi solo durante finestre operative concordate.
              Ogni modifica viene registrata negli audit.
            </p>
          </div>

          {snapshots.map((snapshot) => (
            <EventOpeningCard key={snapshot.event.id} snapshot={snapshot} />
          ))}

          {snapshots.length === 0 ? (
            <div className="rounded-lg border border-[#d8dece] bg-white p-5 text-sm text-[#5e6d63]">
              Nessun evento visibile.
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Bootstrap ruoli</h2>
          <p className="mt-3 text-sm text-[#5e6d63]">
            Ruoli assegnati: {roles?.length ?? 0}
          </p>
        </section>
      </section>
    </main>
  );

  async function getOpeningSnapshots(): Promise<EventSnapshot[]> {
    const { data: events } = await serviceSupabase
      .from("events")
      .select(
        "id,slug,title,status,city,country,starts_on,ends_on,registration_opens_at,registration_closes_at"
      )
      .order("starts_on", { ascending: false });

    return Promise.all(((events ?? []) as EventRow[]).map(getEventSnapshot));
  }

  async function getEventSnapshot(event: EventRow): Promise<EventSnapshot> {
    const { data: registrations } = await serviceSupabase
      .from("registrations")
      .select("id,participant_id,status,submitted_at")
      .eq("event_id", event.id)
      .order("submitted_at", { ascending: false });
    const registrationRows = (registrations ?? []) as RegistrationRow[];
    const registrationIds = registrationRows.map((row) => row.id);
    const participantIds = registrationRows.map((row) => row.participant_id);
    const emptyResult = { data: [] };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: assignments },
      { data: qrTokens },
      { data: accessibilityNeeds },
      { data: contacts },
      { data: emailErrors },
    ] = await Promise.all([
      registrationIds.length > 0
        ? serviceSupabase
            .from("participant_group_assignments")
            .select("registration_id,status,source,is_current,assignment_reason")
            .in("registration_id", registrationIds)
            .eq("is_current", true)
        : Promise.resolve(emptyResult),
      registrationIds.length > 0
        ? serviceSupabase
            .from("qr_tokens")
            .select("registration_id")
            .in("registration_id", registrationIds)
        : Promise.resolve(emptyResult),
      registrationIds.length > 0
        ? serviceSupabase
            .from("accessibility_needs")
            .select("registration_id,needs_operational_support")
            .in("registration_id", registrationIds)
        : Promise.resolve(emptyResult),
      participantIds.length > 0
        ? serviceSupabase
            .from("participant_contacts")
            .select("participant_id,email")
            .in("participant_id", participantIds)
            .eq("is_primary", true)
        : Promise.resolve(emptyResult),
      serviceSupabase
        .from("audit_logs")
        .select("id")
        .eq("event_id", event.id)
        .in("action", [
          "email.magic_link_failed",
          "email.registration_confirmation_failed",
        ])
        .gte("created_at", since),
    ]);
    const assignmentByRegistrationId = new Map(
      ((assignments ?? []) as AssignmentRow[]).map((row) => [
        row.registration_id,
        row,
      ])
    );
    const qrRegistrationIds = new Set(
      ((qrTokens ?? []) as QrTokenRow[]).map((row) => row.registration_id)
    );
    const supportRegistrationIds = new Set(
      ((accessibilityNeeds ?? []) as AccessibilityRow[])
        .filter((row) => row.needs_operational_support)
        .map((row) => row.registration_id)
    );
    const emailByParticipantId = new Map(
      ((contacts ?? []) as ContactRow[]).map((row) => [
        row.participant_id,
        row.email,
      ])
    );
    const monitoringRows: RegistrationMonitoringInput[] = registrationRows.map(
      (registration) => {
        const assignment = assignmentByRegistrationId.get(registration.id);

        return {
          submittedAt: registration.submitted_at,
          status: registration.status,
          currentAssignmentStatus: assignment?.status ?? null,
          currentAssignmentSource: assignment?.source ?? null,
          currentAssignmentReason: assignment?.assignment_reason ?? null,
          hasCurrentAssignment: Boolean(assignment),
          hasQrToken: qrRegistrationIds.has(registration.id),
          needsOperationalSupport: supportRegistrationIds.has(registration.id),
          email: emailByParticipantId.get(registration.participant_id) ?? null,
        };
      }
    );

    return {
      event,
      openingState: getOpeningState(event),
      summary: summarizeRegistrationMonitoring(monitoringRows),
      emailErrorsLast24Hours: emailErrors?.length ?? 0,
    };
  }
}

function EventOpeningCard({ snapshot }: { snapshot: EventSnapshot }) {
  const { event, summary } = snapshot;

  return (
    <article className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{event.title}</h3>
            <span className="rounded-full border border-[#c8d5be] bg-[#eef2e7] px-3 py-1 text-xs font-semibold text-[#38563d]">
              {openingStateLabel(snapshot.openingState)}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#5e6d63]">
            {event.city}, {event.country} - {event.slug}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Evento" value={formatDateRange(event.starts_on, event.ends_on)} />
            <Info label="Apre" value={formatDateTime(event.registration_opens_at)} />
            <Info label="Chiude" value={formatDateTime(event.registration_closes_at)} />
          </dl>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <OpeningForm
            eventId={event.id}
            intent="open"
            label="Apri ora"
            tone="primary"
          />
          <OpeningForm
            eventId={event.id}
            intent="pause"
            label="Pausa"
            tone="secondary"
          />
          <OpeningForm
            eventId={event.id}
            intent="draft"
            label="Nascondi"
            tone="secondary"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EventValue label="Iscrizioni" value={summary.total} />
        <EventValue label="Ultime 24 ore" value={summary.last24Hours} />
        <EventValue label="Gruppo probabile" value={summary.probableGroup} />
        <EventValue label="Supporto richiesto" value={summary.needsOperationalSupport} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WatchItem label="Senza gruppo corrente" value={summary.withoutCurrentGroup} />
        <WatchItem label="QR mancante" value={summary.missingQrToken} />
        <WatchItem label="Email fallite 24h" value={snapshot.emailErrorsLast24Hours} />
        <WatchItem label="Email duplicate" value={summary.duplicateContactEmails} />
      </div>

      <p className="mt-4 text-sm text-[#5e6d63]">
        Scelte gruppo: {summary.participantSelectedGroup} dichiarate,
        {` ${summary.ruleMatchedGroup}`} da regola, {summary.newcomerGroup} nuovi
        partecipanti.
      </p>
    </article>
  );
}

function OpeningForm({
  eventId,
  intent,
  label,
  tone,
}: {
  eventId: string;
  intent: string;
  label: string;
  tone: "primary" | "secondary";
}) {
  const className =
    tone === "primary"
      ? "min-h-11 rounded-md bg-[#2f5e46] px-4 text-sm font-semibold text-white transition hover:bg-[#254b38]"
      : "min-h-11 rounded-md border border-[#c8d5be] bg-white px-4 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]";

  return (
    <form action={updateEventOpeningState}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="intent" value={intent} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}

function StatusMessage({
  error,
  saved,
}: {
  error?: string;
  saved?: string;
}) {
  if (saved) {
    return (
      <p className="rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        Configurazione apertura aggiornata.
      </p>
    );
  }

  if (!error) {
    return null;
  }

  const messages: Record<string, string> = {
    invalid: "Comando apertura non valido.",
    "not-found": "Evento non trovato.",
  };

  return (
    <p className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {messages[error] ?? "Non è stato possibile aggiornare l'apertura."}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d8dece] bg-white p-5">
      <p className="text-sm text-[#5e6d63]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function WatchItem({ label, value }: { label: string; value: number }) {
  const hasIssue = value > 0;

  return (
    <div
      className={
        hasIssue
          ? "border-l-4 border-[#b85f47] bg-[#fff8f5] px-4 py-3"
          : "border-l-4 border-[#c8d5be] bg-[#f8faf5] px-4 py-3"
      }
    >
      <p className="text-sm text-[#5e6d63]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EventValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-[#e6eadf] pt-3">
      <p className="text-sm text-[#5e6d63]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#6b7a70]">{label}</dt>
      <dd className="mt-1 font-medium text-[#1c241f]">{value}</dd>
    </div>
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) {
    return "Date da definire";
  }

  if (!end || start === end) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Senza limite";
  }

  return new Intl.DateTimeFormat("it", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
