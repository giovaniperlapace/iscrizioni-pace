import { redirect } from "next/navigation";

import { updateParticipantDashboard } from "@/app/actions";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { ACCESSIBILITY_DIFFICULTIES } from "@/lib/questionnaire/registration";
import { canParticipantEditRegistration } from "@/lib/registrations/participant-dashboard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RegistrationRow = {
  id: string;
  event_id: string;
  participant_id: string;
  status: string;
  submitted_at: string;
  events: Related<EventRow>;
  participants: Related<ParticipantRow>;
};

type EventRow = {
  id: string;
  title: string;
  slug: string;
  city: string;
  country: string;
  starts_on: string | null;
  ends_on: string | null;
  registration_closes_at: string | null;
};

type ParticipantRow = {
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  preferred_locale: string | null;
  country_other: string | null;
  city_other: string | null;
  has_previous_santegidio_participation: boolean | null;
  participates_with_group: boolean | null;
  public_code: string | null;
};

type Related<T> = T | T[] | null;

type ContactRow = {
  id: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

type AccessibilityRow = {
  washington_group_answers: Record<string, boolean> | null;
  needs_operational_support: boolean;
  operational_notes: string | null;
};

type AttendanceRow = {
  day: string | null;
  choice: "yes" | "no" | "unknown";
};

type MomentRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
};

type MomentChoiceRow = {
  moment_id: string;
  choice: "yes" | "no" | "unknown";
};

type GroupAssignmentRow = {
  status: string;
  groups: Related<{
    name: string;
    primary_leader_name: string | null;
  }>;
};

type QuestionnaireRow = {
  questionnaire_version: string;
  answers: {
    birthPlace?: string | null;
    nationality?: string | null;
    groupParticipation?: {
      participatesWithGroup?: boolean | null;
      groupName?: string | null;
    };
  } | null;
};

type QrStatusRow = {
  status: string;
  expires_at: string | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PartecipanteDashboardPage({
  searchParams,
}: PageProps) {
  const params = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "partecipante");

  if (!auth) {
    redirect("/login");
  }

  const { data: registrationData } = await supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,submitted_at,events(id,title,slug,city,country,starts_on,ends_on,registration_closes_at),participants!inner(auth_user_id,first_name,last_name,birth_date,preferred_locale,country_other,city_other,has_previous_santegidio_participation,participates_with_group,public_code)"
    )
    .order("submitted_at", { ascending: false });

  const registrations = ((registrationData ?? []) as RegistrationRow[]).filter(
    (registration) => relatedOne(registration.participants)?.auth_user_id === auth.user.id
  );
  const selectedRegistration = registrations[0] ?? null;
  const participant = selectedRegistration
    ? relatedOne(selectedRegistration.participants)
    : null;
  const event = selectedRegistration ? relatedOne(selectedRegistration.events) : null;

  const registrationId = selectedRegistration?.id;
  const participantId = selectedRegistration?.participant_id;
  const eventId = selectedRegistration?.event_id;

  const [
    contactsResult,
    accessibilityResult,
    attendanceResult,
    momentsResult,
    momentChoicesResult,
    groupAssignmentsResult,
    questionnaireResult,
    qrStatusResult,
  ] = registrationId && participantId && eventId
    ? await Promise.all([
        supabase
          .from("participant_contacts")
          .select("id,email,phone,is_primary")
          .eq("participant_id", participantId)
          .order("is_primary", { ascending: false }),
        supabase
          .from("accessibility_needs")
          .select("washington_group_answers,needs_operational_support,operational_notes")
          .eq("registration_id", registrationId)
          .maybeSingle(),
        supabase
          .from("event_attendance_choices")
          .select("day,choice")
          .eq("registration_id", registrationId)
          .order("day"),
        supabase
          .from("event_moments")
          .select("id,title,starts_at,ends_at")
          .eq("event_id", eventId)
          .eq("is_public", true)
          .order("starts_at"),
        supabase
          .from("moment_attendance_choices")
          .select("moment_id,choice")
          .eq("registration_id", registrationId),
        supabase
          .from("participant_group_assignments")
          .select("status,groups(name,primary_leader_name)")
          .eq("registration_id", registrationId),
        supabase
          .from("registration_questionnaire_answers")
          .select("questionnaire_version,answers")
          .eq("registration_id", registrationId)
          .order("created_at", { ascending: false })
          .limit(1),
        getQrStatus(registrationId),
      ])
    : [
        { data: [] },
        { data: null },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
      ];

  const contacts = (contactsResult.data ?? []) as ContactRow[];
  const primaryContact = contacts[0] ?? null;
  const accessibility = accessibilityResult.data as AccessibilityRow | null;
  const attendanceChoices = (attendanceResult.data ?? []) as AttendanceRow[];
  const moments = (momentsResult.data ?? []) as MomentRow[];
  const momentChoices = (momentChoicesResult.data ?? []) as MomentChoiceRow[];
  const groupAssignments = (groupAssignmentsResult.data ??
    []) as GroupAssignmentRow[];
  const questionnaire =
    ((questionnaireResult.data ?? []) as QuestionnaireRow[])[0] ?? null;
  const qrStatus = qrStatusResult.data as QrStatusRow | null;
  const editable =
    selectedRegistration &&
    canParticipantEditRegistration({
      status: selectedRegistration.status,
      events: event,
    });
  const eventDays = buildEventDays(event?.starts_on ?? null, event?.ends_on ?? null);
  const selectedDays = new Set(
    attendanceChoices
      .filter((choice) => choice.choice === "yes" && choice.day)
      .map((choice) => choice.day as string)
  );
  const availabilityUnknown =
    attendanceChoices.length === 0 ||
    attendanceChoices.some((choice) => choice.choice === "unknown");
  const momentChoiceById = new Map(
    momentChoices.map((choice) => [choice.moment_id, choice.choice])
  );
  const sensitiveNeedCount = Object.values(
    accessibility?.washington_group_answers ?? {}
  ).filter(Boolean).length;
  const hasAccessibilityRequest =
    Boolean(accessibility?.needs_operational_support) ||
    Boolean(accessibility?.operational_notes) ||
    sensitiveNeedCount > 0;
  const attendanceSummary = availabilityUnknown
    ? "Da comunicare"
    : eventDays
        .filter((day) => selectedDays.has(day))
        .map(formatDate)
        .join(", ") || "Non indicata";
  const selectedPanels = moments.filter(
    (moment) => momentChoiceById.get(moment.id) === "yes"
  );
  const supportSummary = hasAccessibilityRequest
    ? "Supporto richiesto"
    : "Nessun supporto richiesto";

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Area partecipante
          </p>
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              {participant
                ? `${participant.first_name} ${participant.last_name}`
                : "Dashboard partecipante"}
            </h1>
            <p className="mt-3 max-w-3xl text-[#4b5a50]">
              {event
                ? `${event.title} - ${event.city}, ${event.country}`
                : `Accesso verificato per ${auth.user.email}.`}
            </p>
          </div>
          {params.saved ? (
            <p className="rounded-md border border-[#b9d5bd] bg-[#f0f8ed] px-3 py-2 text-sm text-[#315e3b]">
              Modifiche salvate.
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
              {dashboardErrorMessage(firstParam(params.error))}
            </p>
          ) : null}
        </header>

        {!selectedRegistration || !participant || !event ? (
          <section className="rounded-lg border border-[#d8dece] bg-white p-5">
            <h2 className="text-lg font-semibold">Nessuna iscrizione collegata</h2>
            <p className="mt-2 text-sm leading-6 text-[#5e6d63]">
              Questa sessione non risulta collegata a un partecipante. Usa il
              magic link ricevuto via email o avvia di nuovo l&apos;accesso dalla home.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-2">
              <Panel title="Panel a cui sei iscritto">
                {selectedPanels.length > 0 ? (
                  selectedPanels.map((panel) => (
                    <div
                      key={panel.id}
                      className="grid gap-1 border-b border-[#e6eadf] pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="font-medium">{panel.title}</p>
                      <p className="text-sm text-[#66745f]">
                        {formatDateTime(panel.starts_at)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-[#66745f]">
                    I panel non sono ancora disponibili per l&apos;iscrizione
                    dalla dashboard. Quando ti iscriverai a un panel, qui
                    compariranno titolo, data, ora e informazioni operative.
                  </p>
                )}
              </Panel>

              <Panel title="Gruppo">
                {groupAssignments.length > 0 ? (
                  groupAssignments.map((assignment) => {
                    const group = relatedOne(assignment.groups);

                    return (
                      <div key={`${group?.name}-${assignment.status}`}>
                        <p className="font-medium">{group?.name ?? "Gruppo"}</p>
                        <p className="text-sm text-[#66745f]">
                          {group?.primary_leader_name
                            ? `Referente: ${group.primary_leader_name}`
                            : "Referente non indicato"}
                        </p>
                        <p className="text-sm text-[#66745f]">
                          Stato: {groupStatusLabel(assignment.status)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-[#66745f]">
                    Nessun gruppo collegato a questa iscrizione.
                  </p>
                )}
              </Panel>
            </section>

            <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5 md:grid-cols-[14rem_1fr] md:items-center">
              <QrPreview participantCode={participant.public_code ?? ""} />
              <div className="grid gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#66745f]">
                    QR code evento
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    Area accesso pronta per il QR personale
                  </h2>
                </div>
                <p className="text-sm leading-6 text-[#5e6d63]">
                  Qui verrà visualizzato il QR code da usare per l&apos;accesso
                  all&apos;evento e ai panel quando l&apos;organizzazione abiliterà
                  la consegna sicura. Nel frattempo il codice partecipante resta
                  il riferimento operativo da comunicare all&apos;accoglienza.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Info
                    label="Stato QR"
                    value={qrStatus ? qrStatusLabel(qrStatus) : "In preparazione"}
                  />
                  <Info
                    label="Il tuo codice"
                    value={participant.public_code ?? "Non assegnato"}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-6">
              <section className="flex flex-col gap-4 rounded-lg border border-[#d8dece] bg-white p-5">
                <div className="border-b border-[#e6eadf] pb-2">
                  <h2 className="text-xl font-semibold">Riepilogo iscrizione</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5e6d63]">
                    Questo è il riepilogo della tua iscrizione per {event.title},
                    che si terrà nei giorni {formatDate(event.starts_on)} -{" "}
                    {formatDate(event.ends_on)}.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Info
                    label="Iscrizione effettuata il"
                    value={formatDateTime(selectedRegistration.submitted_at)}
                  />
                  <Info
                    label="Email"
                    value={primaryContact?.email ?? auth.user.email ?? "Non indicata"}
                  />
                  <EditableInfo
                    label="Telefono"
                    value={primaryContact?.phone ?? "Non indicato"}
                    editable={Boolean(editable)}
                  >
                    <form action={updateParticipantDashboard} className="grid gap-3">
                      <BaseDashboardFields registrationId={selectedRegistration.id} />
                      <PreserveLocale value={participant.preferred_locale ?? "it"} />
                      <PreserveAttendance
                        availabilityUnknown={availabilityUnknown}
                        selectedDays={[...selectedDays]}
                      />
                      <PreserveMoments momentChoices={momentChoices} />
                      <PreserveAccessibility
                        accessibility={accessibility}
                      />
                      <Field label="Telefono">
                        <input
                          name="phone"
                          className="field"
                          defaultValue={primaryContact?.phone ?? ""}
                          placeholder="+3906000000"
                          autoComplete="tel"
                        />
                      </Field>
                      <SaveInlineButton editable={Boolean(editable)} />
                    </form>
                  </EditableInfo>
                  <EditableInfo
                    label="Lingua preferita"
                    value={
                      (participant.preferred_locale ?? "it") === "en"
                        ? "English"
                        : "Italiano"
                    }
                    editable={Boolean(editable)}
                  >
                    <form action={updateParticipantDashboard} className="grid gap-3">
                      <BaseDashboardFields registrationId={selectedRegistration.id} />
                      <PreservePhone value={primaryContact?.phone ?? null} />
                      <PreserveAttendance
                        availabilityUnknown={availabilityUnknown}
                        selectedDays={[...selectedDays]}
                      />
                      <PreserveMoments momentChoices={momentChoices} />
                      <PreserveAccessibility
                        accessibility={accessibility}
                      />
                      <Field label="Lingua preferita">
                        <select
                          name="preferredLocale"
                          className="field"
                          defaultValue={participant.preferred_locale ?? "it"}
                        >
                          <option value="it">Italiano</option>
                          <option value="en">English</option>
                        </select>
                      </Field>
                      <SaveInlineButton editable={Boolean(editable)} />
                    </form>
                  </EditableInfo>
                  <Info
                    label="Data di nascita"
                    value={formatDate(participant.birth_date)}
                  />
                  <Info
                    label="Luogo di nascita"
                    value={questionnaire?.answers?.birthPlace ?? "Non indicato"}
                  />
                  <Info
                    label="Nazionalità"
                    value={questionnaire?.answers?.nationality ?? "Non indicata"}
                  />
                </div>

                <EditableInfo
                  label="Presenza prevista"
                  value={attendanceSummary}
                  editable={Boolean(editable)}
                >
                  <form action={updateParticipantDashboard} className="grid gap-3">
                    <BaseDashboardFields registrationId={selectedRegistration.id} />
                    <PreservePhone value={primaryContact?.phone ?? null} />
                    <PreserveLocale value={participant.preferred_locale ?? "it"} />
                    <PreserveMoments momentChoices={momentChoices} />
                    <PreserveAccessibility accessibility={accessibility} />
                    <fieldset
                      disabled={!editable}
                      className="grid gap-3 disabled:opacity-70"
                    >
                      <label className="flex gap-3 rounded-md border border-[#d8dece] p-3 text-sm">
                        <input
                          type="checkbox"
                          name="availabilityUnknown"
                          defaultChecked={availabilityUnknown}
                          className="mt-1"
                        />
                        <span>Comunicherò più avanti i giorni di presenza.</span>
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {eventDays.map((day) => (
                          <label
                            key={day}
                            className="flex gap-3 rounded-md border border-[#d8dece] p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              name="availabilityDays"
                              value={day}
                              defaultChecked={selectedDays.has(day)}
                              className="mt-1"
                            />
                            <span>{formatDate(day)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <SaveInlineButton editable={Boolean(editable)} />
                  </form>
                </EditableInfo>

                <EditableInfo
                  label="Accessibilità e supporto"
                  value={
                    accessibility?.operational_notes
                      ? `${supportSummary}: ${accessibility.operational_notes}`
                      : supportSummary
                  }
                  editable={Boolean(editable)}
                  >
                  <form action={updateParticipantDashboard} className="grid gap-3">
                    <BaseDashboardFields registrationId={selectedRegistration.id} />
                    <PreservePhone value={primaryContact?.phone ?? null} />
                    <PreserveLocale value={participant.preferred_locale ?? "it"} />
                    <PreserveAttendance
                      availabilityUnknown={availabilityUnknown}
                      selectedDays={[...selectedDays]}
                    />
                    <PreserveMoments momentChoices={momentChoices} />
                    <fieldset
                      disabled={!editable}
                      className="grid gap-3 disabled:opacity-70"
                    >
                      <input
                        id="hasAccessibilityNeeds"
                        type="checkbox"
                        name="hasAccessibilityNeeds"
                        defaultChecked={hasAccessibilityRequest}
                        className="peer absolute ml-3 mt-4 h-4 w-4"
                      />
                      <label
                        htmlFor="hasAccessibilityNeeds"
                        className="block rounded-md border border-[#d8dece] py-3 pl-10 pr-3 text-sm"
                      >
                        Desidero richiedere supporto per l&apos;accessibilità
                        all&apos;evento.
                      </label>
                      <div className="hidden gap-3 peer-checked:grid">
                        <div>
                        <h3 className="font-semibold">
                          Quali aspetti dobbiamo considerare?
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
                          Puoi selezionare una o più opzioni utili per organizzare
                          meglio l&apos;accoglienza.
                        </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {ACCESSIBILITY_DIFFICULTIES.map((difficulty) => (
                            <label
                              key={difficulty.key}
                              className="flex min-h-14 items-start gap-3 rounded-md border border-[#d8dece] p-3 text-sm text-[#38453c]"
                            >
                              <input
                                name={`accessibility_${difficulty.key}`}
                                type="checkbox"
                                defaultChecked={Boolean(
                                  accessibility?.washington_group_answers?.[
                                    difficulty.key
                                  ]
                                )}
                                className="mt-1 h-4 w-4"
                              />
                              <span>{difficulty.label.it}</span>
                            </label>
                          ))}
                        </div>
                        <Field label="Indicazioni pratiche per l'organizzazione">
                          <textarea
                            name="accessibilityNotes"
                            className="field min-h-28"
                            defaultValue={accessibility?.operational_notes ?? ""}
                          />
                        </Field>
                      </div>
                    </fieldset>
                    <SaveInlineButton editable={Boolean(editable)} />
                  </form>
                </EditableInfo>

                {!editable ? (
                  <p className="text-sm text-[#66745f]">
                    La finestra di modifica non è attiva per questa iscrizione.
                  </p>
                ) : null}
              </section>

            </section>
          </>
        )}
      </section>
    </main>
  );
}

async function getQrStatus(registrationId: string): Promise<{ data: QrStatusRow | null }> {
  try {
    const serviceSupabase = createSupabaseServiceClient();
    const { data } = await serviceSupabase
      .from("qr_tokens")
      .select("status,expires_at")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: (data as QrStatusRow | null) ?? null };
  } catch {
    return { data: null };
  }
}

function QrPreview({ participantCode }: { participantCode: string }) {
  const cells = buildQrPreviewCells(participantCode || "PACE");

  return (
    <div className="mx-auto grid w-full max-w-48 gap-3">
      <div
        className="grid aspect-square grid-cols-9 rounded-md border border-[#cbd7c1] bg-[#f7f8f3] p-3"
        aria-hidden="true"
      >
        {cells.map((active, index) => (
          <span
            key={index}
            className={active ? "bg-[#1c241f]" : "bg-transparent"}
          />
        ))}
      </div>
      <p className="text-center font-mono text-sm font-semibold text-[#38453c]">
        {participantCode || "QR"}
      </p>
    </div>
  );
}

function EditableInfo({
  label,
  value,
  editable,
  children,
}: {
  label: string;
  value: string;
  editable: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-[#d8dece] p-4 sm:col-span-2">
      <summary className="grid cursor-pointer list-none gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#66745f]">
            {label}
          </p>
          <p className="mt-1 text-sm leading-6">{value}</p>
        </div>
        <span
          className="grid size-8 place-items-center rounded-full border border-[#cbd7c1] text-lg text-[#2f5e46] group-open:bg-[#eef3e8]"
          aria-hidden="true"
          title={editable ? "Modifica" : "Modifica non disponibile"}
        >
          &#9998;
        </span>
      </summary>
      <div className="mt-4 border-t border-[#e6eadf] pt-4">{children}</div>
    </details>
  );
}

function BaseDashboardFields({ registrationId }: { registrationId: string }) {
  return <input type="hidden" name="registrationId" value={registrationId} />;
}

function PreservePhone({ value }: { value: string | null }) {
  return value ? <input type="hidden" name="phone" value={value} /> : null;
}

function PreserveLocale({ value }: { value: string | null }) {
  return (
    <input
      type="hidden"
      name="preferredLocale"
      value={value === "en" ? "en" : "it"}
    />
  );
}

function PreserveAttendance({
  availabilityUnknown,
  selectedDays,
}: {
  availabilityUnknown: boolean;
  selectedDays: string[];
}) {
  return (
    <>
      {availabilityUnknown ? (
        <input type="hidden" name="availabilityUnknown" value="on" />
      ) : null}
      {!availabilityUnknown
        ? selectedDays.map((day) => (
            <input key={day} type="hidden" name="availabilityDays" value={day} />
          ))
        : null}
    </>
  );
}

function PreserveMoments({
  momentChoices,
}: {
  momentChoices: MomentChoiceRow[];
}) {
  return (
    <>
      {momentChoices.map((choice) => (
        <input
          key={choice.moment_id}
          type="hidden"
          name={`moment_${choice.moment_id}`}
          value={choice.choice}
        />
      ))}
    </>
  );
}

function PreserveAccessibility({
  accessibility,
}: {
  accessibility: AccessibilityRow | null;
}) {
  const hasAccessibilityRequest =
    Boolean(accessibility?.needs_operational_support) ||
    Boolean(accessibility?.operational_notes) ||
    Object.values(accessibility?.washington_group_answers ?? {}).some(Boolean);

  return (
    <>
      {hasAccessibilityRequest ? (
        <input type="hidden" name="hasAccessibilityNeeds" value="on" />
      ) : null}
      {Object.entries(accessibility?.washington_group_answers ?? {}).map(
        ([key, value]) =>
          value ? (
            <input
              key={key}
              type="hidden"
              name={`accessibility_${key}`}
              value="on"
            />
          ) : null
      )}
      {accessibility?.needs_operational_support ? (
        <input type="hidden" name="needsOperationalSupport" value="on" />
      ) : null}
      {accessibility?.operational_notes ? (
        <input
          type="hidden"
          name="accessibilityNotes"
          value={accessibility.operational_notes}
        />
      ) : null}
    </>
  );
}

function SaveInlineButton({ editable }: { editable: boolean }) {
  return (
    <button
      type="submit"
      disabled={!editable}
      className="w-fit rounded-md bg-[#2f5e46] px-4 py-2 text-sm font-semibold text-white hover:bg-[#244938] disabled:cursor-not-allowed disabled:bg-[#9aa79b]"
    >
      Salva
    </button>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#d8dece] bg-white p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#38453c]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#66745f]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function relatedOne<T>(value: Related<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function buildEventDays(startsOn: string | null, endsOn: string | null): string[] {
  if (!startsOn) {
    return [];
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn ?? startsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: string[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }

  return days;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Non indicata";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseDateOnly(value)
    : new Date(value);

  return date && !Number.isNaN(date.getTime())
    ? DATE_FORMATTER.format(date)
    : "Non indicata";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Non indicata";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Non indicata"
    : DATE_TIME_FORMATTER.format(date);
}

function qrStatusLabel(qrStatus: QrStatusRow): string {
  if (qrStatus.status === "active") {
    return qrStatus.expires_at
      ? `Attivo fino al ${formatDate(qrStatus.expires_at)}`
      : "Attivo";
  }

  if (qrStatus.status === "revoked") {
    return "Revocato";
  }

  if (qrStatus.status === "expired") {
    return "Scaduto";
  }

  return qrStatus.status;
}

function groupStatusLabel(status: string): string {
  switch (status) {
    case "probable":
      return "Da confermare";
    case "confirmed":
      return "Confermato";
    case "rejected":
      return "Non confermato";
    default:
      return status;
  }
}

function dashboardErrorMessage(value: string | undefined): string {
  if (value === "closed") {
    return "La finestra di modifica dell'iscrizione non è attiva.";
  }

  if (value === "not-found") {
    return "Iscrizione non trovata per questa sessione.";
  }

  return value || "Non è stato possibile salvare le modifiche.";
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQrPreviewCells(seed: string): boolean[] {
  const cells: boolean[] = [];
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const inTopLeft = row < 3 && column < 3;
      const inTopRight = row < 3 && column > 5;
      const inBottomLeft = row > 5 && column < 3;
      const finder = inTopLeft || inTopRight || inBottomLeft;
      const finderCenter =
        (row === 1 && column === 1) ||
        (row === 1 && column === 7) ||
        (row === 7 && column === 1);
      const patterned = ((hash + row * 17 + column * 29) % 5) < 2;

      cells.push(finder ? finderCenter || row % 2 === 0 || column % 2 === 0 : patterned);
    }
  }

  return cells;
}
