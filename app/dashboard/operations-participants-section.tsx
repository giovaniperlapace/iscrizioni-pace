import Link from "next/link";

import {
  createOperationalTag,
  updateParticipantOperationalTags,
} from "@/app/actions";
import { RegistrationDeleteButton } from "@/app/dashboard/participants/registration-delete-button";
import { AutoFilterForm } from "@/app/dashboard/auto-filter-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  hasActiveOperationsDashboardFilters,
  type OperationsDashboardFilters,
} from "@/lib/registrations/operations-dashboard";
import {
  eventServiceStatusLabel,
  type EventServiceOption,
  type ParticipantEventService,
} from "@/lib/registrations/event-services";
import type {
  OperationalTagOption,
  ParticipantOperationalTag,
} from "@/lib/registrations/operational-tags";

export type OperationsRegistrationChild = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position: number;
};

export type OperationsGroupOption = {
  id: string;
  eventId: string;
  name: string;
};

export type OperationsParticipantRow = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  authUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  publicCode: string | null;
  birthDate: string | null;
  country: string | null;
  city: string | null;
  place: string;
  email: string | null;
  phone: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupStatus: string | null;
  currentServiceId: string | null;
  currentServiceStatus: string | null;
  service: ParticipantEventService | null;
  tagIds: string[];
  tags: ParticipantOperationalTag[];
  childrenCount: number;
  children: OperationsRegistrationChild[];
};

export type OperationsParticipantsSnapshot = {
  participants: OperationsParticipantRow[];
  allParticipants: OperationsParticipantRow[];
  groupOptions: OperationsGroupOption[];
  operationalTags: OperationalTagOption[];
  eventServices: EventServiceOption[];
  filters: OperationsDashboardFilters;
};

type OperationsDashboard = "admin" | "manager";
type OperationsNavMode = "full" | "mini";

export function OperationsParticipantsSection({
  snapshot,
  selectedParticipant,
  canManageEvent,
  dashboard,
  navMode,
  canDeleteRegistration = false,
}: {
  snapshot: OperationsParticipantsSnapshot;
  selectedParticipant: OperationsParticipantRow | null;
  canManageEvent: (eventId: string) => boolean;
  dashboard: OperationsDashboard;
  navMode: OperationsNavMode;
  canDeleteRegistration?: boolean;
}) {
  const currentGroupOptions = getCurrentGroupFilterOptions(snapshot.allParticipants);
  const activeEventId =
    snapshot.allParticipants[0]?.eventId ?? snapshot.operationalTags[0]?.eventId ?? null;
  const basePath = operationsParticipantsPath(dashboard, navMode);
  const idPrefix = `${dashboard}-participant`;

  return (
    <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestione iscritti</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
            Ultime iscrizioni visibili, fino a 200 risultati recenti.
          </p>
        </div>
        {activeEventId ? (
          <form
            action={createOperationalTag}
            className="grid gap-2 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 sm:grid-cols-[1fr_auto_auto]"
            autoComplete="off"
          >
            <input type="hidden" name="eventId" value={activeEventId} />
            <input type="hidden" name="sourceDashboard" value={dashboard} />
            <input type="hidden" name="nav" value={navMode} />
            <label className="sr-only" htmlFor={`${idPrefix}-new-tag`}>
              Nuovo tag operativo
            </label>
            <input
              id={`${idPrefix}-new-tag`}
              name="operationalTagLabel"
              className="field min-h-10 bg-white text-sm font-normal"
              maxLength={40}
              placeholder="Nuovo tag"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <label className="grid min-h-10 w-12 place-items-center rounded-md border border-[var(--peace-border-strong)] bg-white">
              <span className="sr-only">Colore tag</span>
              <input name="color" type="color" defaultValue="#0f5f8f" className="h-7 w-8" />
            </label>
            <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Crea
            </PendingSubmitButton>
          </form>
        ) : null}
      </div>

      <div className="mt-5 overflow-x-auto">
        <AutoFilterForm
          action={`/dashboard/${dashboard}`}
          debounceMs={900}
          blockWhilePending={false}
          defaults={{
            q: "",
            contact: "",
            group: "all",
            service: "all",
            tag: "all",
            status: "all",
          }}
        >
          <input type="hidden" name="section" value="iscritti" />
          <input type="hidden" name="nav" value={navMode} />
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Iscrizione</th>
                <th className="py-3 pr-4 font-semibold">Contatti</th>
                <th className="py-3 pr-4 font-semibold">Gruppo</th>
                <th className="py-3 pr-4 font-semibold">Servizio</th>
                <th className="py-3 pr-4 font-semibold">Tag</th>
                <th className="py-3 text-right font-semibold">Azioni</th>
              </tr>
              <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] align-top">
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor={`${idPrefix}-q`}>Cerca iscrizione</label>
                  <input
                    id={`${idPrefix}-q`}
                    name="q"
                    defaultValue={snapshot.filters.q}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Nome, codice, email"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor={`${idPrefix}-contact`}>Cerca contatto</label>
                  <input
                    id={`${idPrefix}-contact`}
                    name="contact"
                    defaultValue={snapshot.filters.contact}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Email, telefono"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor={`${idPrefix}-group`}>Gruppo</label>
                  <select
                    id={`${idPrefix}-group`}
                    name="group"
                    defaultValue={snapshot.filters.group}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i gruppi</option>
                    <option value="none">Senza gruppo</option>
                    {currentGroupOptions.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor={`${idPrefix}-service`}>Servizio</label>
                  <select
                    id={`${idPrefix}-service`}
                    name="service"
                    defaultValue={snapshot.filters.service}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i servizi</option>
                    <option value="none">Senza servizio</option>
                    {snapshot.eventServices.map((service) => (
                      <option key={service.id} value={service.id}>{service.label}</option>
                    ))}
                  </select>
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor={`${idPrefix}-tag`}>Tag</label>
                  <select
                    id={`${idPrefix}-tag`}
                    name="tag"
                    defaultValue={snapshot.filters.tag}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i tag</option>
                    <option value="none">Senza tag</option>
                    {snapshot.operationalTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>{tag.label}</option>
                    ))}
                  </select>
                </th>
                <th className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <label className="sr-only" htmlFor={`${idPrefix}-status`}>Stato</label>
                    <select
                      id={`${idPrefix}-status`}
                      name="status"
                      defaultValue={snapshot.filters.status}
                      className="field min-h-10 max-w-36 bg-white text-sm font-normal"
                    >
                      <option value="all">Tutti</option>
                      <option value="submitted">Inviata</option>
                      <option value="confirmed">Confermata</option>
                      <option value="cancelled">Annullata</option>
                    </select>
                    {hasActiveOperationsDashboardFilters(snapshot.filters) ? (
                      <Link
                        href={basePath}
                        className="inline-flex min-h-10 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-white"
                      >
                        Reset
                      </Link>
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.participants.map((participant) => {
                const canManage = canManageEvent(participant.eventId);

                return (
                  <tr
                    key={participant.registrationId}
                    className="border-b border-[var(--peace-border)] align-top last:border-b-0"
                  >
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-[var(--peace-ink)]">{participant.name}</p>
                      <p className="mt-1 text-xs text-[var(--peace-muted)]">
                        {participant.publicCode ?? "Senza codice"} - {statusLabel(participant.registrationStatus)}
                      </p>
                    </td>
                    <td className="py-4 pr-4 text-[var(--peace-ink)]">
                      <p>{participant.email ?? "Email non indicata"}</p>
                      <p className="mt-1 text-xs text-[var(--peace-muted)]">
                        {participant.phone ?? "Telefono non indicato"}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <p className="font-medium">{participant.currentGroupName ?? "Nessun gruppo corrente"}</p>
                      <p className="mt-1 text-xs text-[var(--peace-muted)]">
                        {groupStatusLabel(participant.currentGroupStatus)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <ParticipantServiceSummary service={participant.service} />
                    </td>
                    <td className="py-4 pr-4">
                      <OperationalTagList tags={participant.tags} emptyLabel="Senza tag" />
                    </td>
                    <td className="py-4 text-right">
                      {canManage ? (
                        <Link
                          href={`${basePath}&edit=${encodeURIComponent(participant.registrationId)}`}
                          scroll={false}
                          className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                        >
                          Dettagli
                        </Link>
                      ) : (
                        <span className="text-sm text-[var(--peace-muted)]">Solo lettura</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AutoFilterForm>
      </div>

      {snapshot.participants.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessuna iscrizione corrisponde ai filtri correnti.
        </p>
      ) : null}

      {selectedParticipant ? (
        <OperationsParticipantEditOverlay
          participant={selectedParticipant}
          groupOptions={snapshot.groupOptions.filter(
            (group) => group.eventId === selectedParticipant.eventId
          )}
          tagOptions={snapshot.operationalTags.filter(
            (tag) => tag.eventId === selectedParticipant.eventId
          )}
          dashboard={dashboard}
          navMode={navMode}
          canDeleteRegistration={canDeleteRegistration}
        />
      ) : null}
    </section>
  );
}

function OperationsParticipantEditOverlay({
  participant,
  groupOptions,
  tagOptions,
  dashboard,
  navMode,
  canDeleteRegistration,
}: {
  participant: OperationsParticipantRow;
  groupOptions: OperationsGroupOption[];
  tagOptions: OperationalTagOption[];
  dashboard: OperationsDashboard;
  navMode: OperationsNavMode;
  canDeleteRegistration: boolean;
}) {
  const includesCurrentGroup =
    !participant.currentGroupId ||
    groupOptions.some((group) => group.id === participant.currentGroupId);
  const visibleGroupOptions =
    includesCurrentGroup || !participant.currentGroupId || !participant.currentGroupName
      ? groupOptions
      : [
          {
            id: participant.currentGroupId,
            eventId: participant.eventId,
            name: participant.currentGroupName,
          },
          ...groupOptions,
        ];
  const basePath = operationsParticipantsPath(dashboard, navMode);

  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <h3 className="text-xl font-semibold">Scheda partecipante</h3>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">
            {participant.name}{participant.publicCode ? ` - ${participant.publicCode}` : ""}
          </p>
        </div>

        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          <form
            action="/dashboard/admin/participants/update"
            method="post"
            className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            data-preserve-dashboard-scroll
          >
            <OperationsFormContext participant={participant} dashboard={dashboard} navMode={navMode} />
            <h4 className="text-sm font-semibold text-[var(--peace-ink)]">Identità</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" name="firstName" defaultValue={participant.firstName ?? ""} />
              <Field label="Cognome" name="lastName" defaultValue={participant.lastName ?? ""} />
              <Field label="Data di nascita" name="birthDate" type="date" defaultValue={participant.birthDate ?? ""} />
              <Field label="Città" name="city" defaultValue={participant.city ?? ""} />
              <Field label="Paese" name="country" defaultValue={participant.country ?? ""} />
            </div>
            <SaveButton />
          </form>

          <section className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
            <h4 className="text-sm font-semibold text-[var(--peace-ink)]">
              Figli partecipanti ({participant.childrenCount})
            </h4>
            {participant.children.length > 0 ? (
              <div className="grid gap-2">
                {participant.children.map((child) => (
                  <div key={child.id} className="rounded-md border border-[var(--peace-border)] bg-white px-3 py-2 text-sm">
                    <p className="font-semibold">{child.first_name} {child.last_name}</p>
                    <p className="mt-1 text-[var(--peace-muted)]">Data di nascita: {formatDate(child.birth_date)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--peace-muted)]">Nessun figlio associato all&apos;iscrizione.</p>
            )}
          </section>

          <form
            action="/dashboard/admin/participants/update"
            method="post"
            className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            data-preserve-dashboard-scroll
          >
            <OperationsFormContext participant={participant} dashboard={dashboard} navMode={navMode} />
            <h4 className="text-sm font-semibold text-[var(--peace-ink)]">Contatti</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" defaultValue={participant.email ?? ""} />
              <Field label="Telefono" name="phone" defaultValue={participant.phone ?? ""} />
            </div>
            <SaveButton />
          </form>

          <form
            action="/dashboard/admin/participants/update"
            method="post"
            className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            data-preserve-dashboard-scroll
          >
            <OperationsFormContext participant={participant} dashboard={dashboard} navMode={navMode} />
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Gruppo
              <select
                name="groupId"
                defaultValue={participant.currentGroupId ?? ""}
                className="min-h-11 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 font-normal text-[var(--peace-ink)]"
              >
                {!participant.currentGroupId ? <option value="">Nessun gruppo corrente</option> : null}
                {visibleGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <SaveButton />
          </form>

          <form
            action={updateParticipantOperationalTags}
            className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
            data-preserve-dashboard-scroll
          >
            <OperationsFormContext participant={participant} dashboard={dashboard} navMode={navMode} />
            <input type="hidden" name="eventId" value={participant.eventId} />
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-[var(--peace-ink)]">Tag operativi</legend>
              <TagCheckboxGrid
                tagOptions={tagOptions}
                selectedTagIds={participant.tagIds}
                emptyLabel="Nessun tag creato per questo evento."
              />
            </fieldset>
            <SaveButton />
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--peace-border)] px-5 py-4">
          {canDeleteRegistration ? (
            <form action="/dashboard/participants/delete" method="post">
              <input type="hidden" name="sourceDashboard" value={dashboard} />
              <input type="hidden" name="registrationId" value={participant.registrationId} />
              <input type="hidden" name="participantId" value={participant.participantId} />
              <input type="hidden" name="nav" value={navMode} />
              <RegistrationDeleteButton participantName={participant.name} />
            </form>
          ) : <span />}
          <Link
            href={basePath}
            scroll={false}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Chiudi
          </Link>
        </div>
      </div>
    </div>
  );
}

function OperationsFormContext({
  participant,
  dashboard,
  navMode,
}: {
  participant: OperationsParticipantRow;
  dashboard: OperationsDashboard;
  navMode: OperationsNavMode;
}) {
  return (
    <>
      <input type="hidden" name="sourceDashboard" value={dashboard} />
      <input type="hidden" name="nav" value={navMode} />
      <input type="hidden" name="registrationId" value={participant.registrationId} />
      <input type="hidden" name="participantId" value={participant.participantId} />
    </>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className="field bg-white font-normal" />
    </label>
  );
}

function SaveButton() {
  return (
    <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
      Salva
    </PendingSubmitButton>
  );
}

function OperationalTagList({ tags, emptyLabel }: { tags: ParticipantOperationalTag[]; emptyLabel: string }) {
  if (tags.length === 0) {
    return <span className="text-sm text-[var(--peace-muted)]">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--peace-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--peace-ink)]">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.label}
        </span>
      ))}
    </div>
  );
}

function ParticipantServiceSummary({ service }: { service: ParticipantEventService | null }) {
  if (!service) {
    return <span className="text-sm text-[var(--peace-muted)]">Senza servizio</span>;
  }

  return (
    <div className="grid gap-1">
      <span className="font-semibold text-[var(--peace-ink)]">{service.serviceLabel}</span>
      <span className="text-xs text-[var(--peace-muted)]">{eventServiceStatusLabel(service.status)}</span>
    </div>
  );
}

function TagCheckboxGrid({
  tagOptions,
  selectedTagIds,
  emptyLabel,
}: {
  tagOptions: OperationalTagOption[];
  selectedTagIds: string[];
  emptyLabel: string;
}) {
  if (tagOptions.length === 0) {
    return <p className="text-sm text-[var(--peace-muted)]">{emptyLabel}</p>;
  }

  const selected = new Set(selectedTagIds);

  return (
    <div className="flex flex-wrap gap-2">
      {tagOptions.map((tag) => (
        <label key={tag.id} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-semibold text-[var(--peace-ink)]">
          <input
            type="checkbox"
            name="tagIds"
            value={tag.id}
            defaultChecked={selected.has(tag.id)}
            className="size-4 accent-[var(--peace-blue-800)]"
          />
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.label}
        </label>
      ))}
    </div>
  );
}

function operationsParticipantsPath(
  dashboard: OperationsDashboard,
  navMode: OperationsNavMode
): string {
  return `/dashboard/${dashboard}?section=iscritti&nav=${navMode}`;
}

function getCurrentGroupFilterOptions(
  participants: OperationsParticipantRow[]
): Array<{ id: string; name: string }> {
  const groupsById = new Map<string, string>();

  for (const participant of participants) {
    if (participant.currentGroupId && participant.currentGroupName) {
      groupsById.set(participant.currentGroupId, participant.currentGroupName);
    }
  }

  return [...groupsById]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "submitted": return "iscrizione inviata";
    case "confirmed": return "iscrizione confermata";
    case "cancelled": return "iscrizione annullata";
    default: return status ?? "stato non indicato";
  }
}

function groupStatusLabel(status: string | null): string {
  switch (status) {
    case "confirmed": return "gruppo confermato";
    case "probable": return "da verificare";
    case "rejected": return "rifiutato";
    default: return "stato gruppo non indicato";
  }
}
