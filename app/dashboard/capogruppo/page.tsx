import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  createGroupLeaderManualRegistration,
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  updateGroupLeaderAssignment,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { ManualAccessibilityFields } from "@/app/dashboard/capogruppo/manual-accessibility-fields";
import { ManualAttendanceFields } from "@/app/dashboard/capogruppo/manual-attendance-fields";
import { getCurrentAuthContext } from "@/lib/auth/session";
import {
  collectDescendantGroupIds,
  matchesGroupLeaderFilter,
  parseGroupLeaderReviewFilter,
  type GroupLeaderReviewFilter,
  type GroupTreeNode,
} from "@/lib/groups/capogruppo-dashboard";
import {
  buildGroupRegistrationUrl,
  getGroupRegistrationLinkStatus,
} from "@/lib/groups/registration-links";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type CapogruppoPageProps = {
  searchParams: Promise<{
    filter?: string;
    error?: string;
    saved?: string;
    groupLinkError?: string;
    groupLinkSaved?: string;
    groupLinkToken?: string;
    groupLinkGroupId?: string;
    manualError?: string;
    manualSaved?: string;
    q?: string;
    sort?: string;
    tool?: string;
    groupId?: string;
  }>;
};

type GroupMembershipRow = {
  group_id: string | null;
};

type GroupRow = {
  id: string;
  event_id: string;
  name: string;
  parent_group_id: string | null;
  node_type: string | null;
  is_assignable: boolean | null;
  is_public_catalog: boolean | null;
  is_active: boolean | null;
  public_label: string | null;
  primary_leader_name: string | null;
  events:
    | { title: string | null; starts_on: string | null; ends_on: string | null }
    | Array<{ title: string | null; starts_on: string | null; ends_on: string | null }>
    | null;
};

type GroupLinkRow = {
  id: string;
  event_id: string;
  group_id: string;
  public_label: string | null;
  internal_label: string | null;
  use_count: number | null;
  max_uses: number | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type GroupLinkView = {
  id: string;
  eventId: string;
  groupId: string;
  publicLabel: string | null;
  internalLabel: string | null;
  useCount: number;
  maxUses: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

type ScopedGroupView = {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  nodeType: string | null;
  isActive: boolean;
  isAssignable: boolean;
  isPublicCatalog: boolean;
  publicLabel: string | null;
  primaryLeaderName: string | null;
  eventStartsOn: string | null;
  eventEndsOn: string | null;
};

type AssignmentRow = {
  id: string;
  registration_id: string;
  group_id: string;
  status: string | null;
  source: string | null;
  confidence: number | null;
  is_current: boolean | null;
  assignment_reason: string | null;
  escalation_depth: number | null;
  leader_internal_note: string | null;
  leader_notification_read_at: string | null;
  leader_decision_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  groups:
    | {
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
      }
    | Array<{
        id: string;
        name: string | null;
        node_type: string | null;
        parent_group_id: string | null;
      }>
    | null;
  registrations:
    | {
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
            }>
          | null;
      }
    | Array<{
        id: string;
        event_id: string;
        status: string | null;
        submitted_at: string | null;
        participants:
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_other: string | null;
              city_other: string | null;
              participant_contacts:
                | Array<{
                    email: string | null;
                    phone: string | null;
                    is_primary: boolean | null;
                  }>
                | null;
              countries:
                | { name_it: string | null }
                | Array<{ name_it: string | null }>
                | null;
              cities:
                | { name: string | null }
                | Array<{ name: string | null }>
                | null;
              participates_with_group: boolean | null;
            }>
          | null;
      }>
    | null;
};

type AssignmentView = {
  id: string;
  registrationId: string;
  groupId: string;
  groupName: string;
  groupNodeType: string | null;
  participantName: string;
  participantCode: string | null;
  participantEmail: string | null;
  participantPhone: string | null;
  participantPlace: string;
  birthDate: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  status: string | null;
  source: string | null;
  confidence: number | null;
  isCurrent: boolean;
  assignmentReason: string | null;
  escalationDepth: number;
  leaderInternalNote: string | null;
  leaderNotificationReadAt: string | null;
  leaderDecisionAt: string | null;
  updatedAt: string | null;
};
type DashboardTool = "link" | "manual";

const FILTER_LABELS: Record<GroupLeaderReviewFilter, string> = {
  all: "Tutti",
  "to-review": "Da verificare",
  probable: "Probabili",
  confirmed: "Confermati",
  rejected: "Rifiutati",
};
const SORT_OPTIONS = [
  { value: "name", label: "Nome" },
  { value: "updated", label: "Aggiornamento recente" },
  { value: "submitted", label: "Iscrizione recente" },
  { value: "status", label: "Stato" },
] as const;
type AssignmentSort = (typeof SORT_OPTIONS)[number]["value"];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EVENT_DAY_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function CapogruppoDashboardPage({
  searchParams,
}: CapogruppoPageProps) {
  const params = await searchParams;
  const filter = params.filter
    ? parseGroupLeaderReviewFilter(params.filter)
    : "all";
  const query = normalizeSearchQuery(params.q);
  const sort = parseAssignmentSort(params.sort);
  const activeTool =
    params.groupLinkToken || params.groupLinkGroupId
      ? "link"
      : parseDashboardTool(params.tool);
  const activeGroupId = params.groupLinkGroupId ?? params.groupId ?? null;
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "capogruppo");

  if (!auth || auth.dashboardRole !== "capogruppo") {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const { data: memberships } = await serviceSupabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", auth.user.id);
  const rootGroupIds = ((memberships ?? []) as GroupMembershipRow[])
    .map((membership) => membership.group_id)
    .filter((groupId): groupId is string => Boolean(groupId));
  const { data: groups } = await serviceSupabase
    .from("groups")
    .select(
      "id,event_id,name,parent_group_id,node_type,is_assignable,is_public_catalog,is_active,public_label,primary_leader_name,events(title,starts_on,ends_on)"
    );
  const groupRows = (groups ?? []) as GroupRow[];
  const activeGroupRows = groupRows.filter((group) => group.is_active ?? true);
  const groupNodes = activeGroupRows.map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);

  const assignments = await getAssignments([...scopedGroupIds]);
  const assignedGroups = groupRows
    .filter((group) => rootGroupIds.includes(group.id))
    .map(toScopedGroupView);
  const scopedGroups = activeGroupRows
    .filter((group) => scopedGroupIds.has(group.id))
    .map(toScopedGroupView);
  const groupLinks = await getGroupLinks([...scopedGroupIds]);
  const filteredAssignments = sortAssignments(
    assignments.filter(
      (assignment) =>
        matchesGroupLeaderFilter(assignment, filter) &&
        matchesAssignmentQuery(assignment, query)
    ),
    sort
  );

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard capogruppo</h1>
          <DashboardRoleTabs
            activeRole="capogruppo"
            eventRoles={auth.eventRoles}
          />
          <DashboardAreaDescription>
            In questa area puoi verificare le assegnazioni dei tuoi gruppi,
            confermare i partecipanti o rimandarli al livello superiore.
          </DashboardAreaDescription>
        </header>

        <StatusMessage
          error={params.error ?? params.groupLinkError}
          saved={params.saved ?? params.groupLinkSaved ?? params.manualSaved}
        />

        <StatusMessage error={params.manualError} saved={undefined} />

        <AssignedScopeSection
          assignedGroups={assignedGroups}
          assignableGroups={scopedGroups.filter(
            (group) => group.isActive && group.isAssignable
          )}
        />

        <section
          id="assegnazioni-gruppo"
          className="rounded-lg border border-[#d8dece] bg-white p-5"
        >
          <div>
            <div>
              <h2 className="text-lg font-semibold">Partecipanti del gruppo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
                Qui trovi le persone collegate ai gruppi che gestisci. Le
                decisioni sul gruppo sono interne e non inviano comunicazioni
                automatiche al partecipante.
              </p>
            </div>
          </div>

          <AssignmentFilters filter={filter} query={query} sort={sort} />

          <AssignmentsTable assignments={filteredAssignments} />
        </section>

        {activeTool ? (
          <DashboardToolOverlay title={dashboardToolTitle(activeTool)}>
            {activeTool === "link" ? (
              <GroupLeaderLinksSection
                groups={scopedGroups}
                links={groupLinks}
                selectedGroupId={activeGroupId}
                createdGroupId={params.groupLinkGroupId ?? null}
                createdUrl={
                  params.groupLinkToken
                    ? buildGroupRegistrationUrl({
                        appUrl: getAppUrl(),
                        token: params.groupLinkToken,
                      })
                    : null
                }
              />
            ) : (
              <ManualRegistrationSection
                groups={scopedGroups}
                selectedGroupId={activeGroupId}
                eventDays={getManualRegistrationEventDays(scopedGroups)}
              />
            )}
          </DashboardToolOverlay>
        ) : null}

      </section>
    </main>
  );

  async function getAssignments(groupIds: string[]): Promise<AssignmentView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data, error } = await serviceSupabase
      .from("participant_group_assignments")
      .select(
        "id,registration_id,group_id,status,source,confidence,is_current,assignment_reason,escalation_depth,leader_internal_note,leader_notification_read_at,leader_decision_at,created_at,updated_at,groups!participant_group_assignments_group_id_fkey(id,name,node_type,parent_group_id),registrations(id,event_id,status,submitted_at,participants(id,first_name,last_name,public_code,birth_date,country_other,city_other,participant_contacts(email,phone,is_primary),countries(name_it),cities(name),participates_with_group))"
      )
      .in("group_id", groupIds)
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[capogruppo:assignments]", error.message);
      return [];
    }

    return ((data ?? []) as AssignmentRow[])
      .map(toAssignmentView)
      .filter((assignment): assignment is AssignmentView => Boolean(assignment));
  }

  async function getGroupLinks(groupIds: string[]): Promise<GroupLinkView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data } = await serviceSupabase
      .from("group_registration_links")
      .select(
        "id,event_id,group_id,public_label,internal_label,use_count,max_uses,created_at,expires_at,revoked_at"
      )
      .in("group_id", groupIds)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    return ((data ?? []) as GroupLinkRow[]).map((link) => ({
      id: link.id,
      eventId: link.event_id,
      groupId: link.group_id,
      publicLabel: link.public_label,
      internalLabel: link.internal_label,
      useCount: link.use_count ?? 0,
      maxUses: link.max_uses,
      createdAt: link.created_at,
      expiresAt: link.expires_at,
      revokedAt: link.revoked_at,
    }));
  }
}

function toScopedGroupView(group: GroupRow): ScopedGroupView {
  return {
    id: group.id,
    eventId: group.event_id,
    eventTitle: relatedOne(group.events)?.title ?? "Evento",
    name: group.name ?? "Gruppo senza nome",
    nodeType: group.node_type,
    isActive: group.is_active ?? true,
    isAssignable: group.is_assignable ?? true,
    isPublicCatalog: group.is_public_catalog ?? true,
    publicLabel: group.public_label,
    primaryLeaderName: group.primary_leader_name,
    eventStartsOn: relatedOne(group.events)?.starts_on ?? null,
    eventEndsOn: relatedOne(group.events)?.ends_on ?? null,
  };
}

function AssignedScopeSection({
  assignedGroups,
  assignableGroups,
}: {
  assignedGroups: ScopedGroupView[];
  assignableGroups: ScopedGroupView[];
}) {
  return (
    <section className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">I tuoi gruppi</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
            Questi sono i gruppi collegati al tuo account capogruppo.
          </p>
        </div>
        <span className="rounded-full border border-[#c8d5be] px-3 py-1 text-sm font-semibold text-[#38563d]">
          {assignableGroups.length} iscrivibili
        </span>
      </div>

      {assignedGroups.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {assignedGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#1c241f]">{group.name}</h3>
                    <ScopeBadge
                      label={
                        group.isActive && group.isAssignable
                          ? "Può ricevere iscrizioni"
                          : "Non disponibile per iscrizioni"
                      }
                      tone={group.isActive ? "green" : "red"}
                    />
                    <ScopeBadge
                      label={
                        group.isPublicCatalog
                          ? "Visibile nel form pubblico"
                          : "Non visibile nel form pubblico"
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#5e6d63]">
                    {group.eventTitle}
                    {group.primaryLeaderName
                      ? ` - referente ${group.primaryLeaderName}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/capogruppo?tool=link&groupId=${encodeURIComponent(group.id)}`}
                    className="min-h-9 rounded-md border border-[#b8c5ad] px-3 py-2 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
                  >
                    Genera link
                  </Link>
                  <Link
                    href={`/dashboard/capogruppo?tool=manual&groupId=${encodeURIComponent(group.id)}`}
                    className="min-h-9 rounded-md bg-[#315c44] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#264a36]"
                  >
                    Inserisci partecipante
                  </Link>
                </div>
              </div>
              {!group.isActive ? (
                <p className="mt-3 rounded-md border border-[#e8c2bd] bg-[#fff6f4] p-3 text-sm leading-6 text-[#8a3f35]">
                  Questo gruppo è collegato al tuo account, ma non è attivo nel
                  catalogo operativo. Prima di usare link o inserimenti manuali
                  serve un intervento di un manager/admin per riattivarlo o
                  collegarti al gruppo corretto.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#5e6d63]">
          Nessun gruppo collegato al tuo account.
        </p>
      )}
    </section>
  );
}

function DashboardToolOverlay({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#1c241f]/45 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-[#d8dece] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#1c241f]">{title}</h2>
          <Link
            href="/dashboard/capogruppo"
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
            aria-label="Chiudi"
          >
            Chiudi
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function GroupLeaderLinksSection({
  groups,
  links,
  selectedGroupId,
  createdGroupId,
  createdUrl,
}: {
  groups: ScopedGroupView[];
  links: GroupLinkView[];
  selectedGroupId: string | null;
  createdGroupId: string | null;
  createdUrl: string | null;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const visibleGroups =
    selectedGroupId && assignableGroups.some((group) => group.id === selectedGroupId)
      ? assignableGroups.filter((group) => group.id === selectedGroupId)
      : assignableGroups;
  const linksByGroupId = new Map<string, GroupLinkView[]>();

  for (const link of links) {
    const groupLinks = linksByGroupId.get(link.groupId) ?? [];
    groupLinks.push(link);
    linksByGroupId.set(link.groupId, groupLinks);
  }

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold">Link iscrizione gruppo</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
          Puoi generare link riservati solo per i gruppi che gestisci. I link
          non rendono il gruppo visibile nel menu pubblico.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {visibleGroups.map((group) => {
          const groupLinks = linksByGroupId.get(group.id) ?? [];

          return (
            <article
              key={group.id}
              className="rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#1c241f]">{group.name}</h3>
                    <span className="rounded-full border border-[#c8d5be] px-2 py-1 text-xs font-semibold text-[#38563d]">
                      {group.isPublicCatalog ? "Visibile nel form" : "Nascosto"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#5e6d63]">
                    {group.eventTitle} - referente{" "}
                    {group.primaryLeaderName ?? "da assegnare"}
                  </p>
                  <p className="mt-2 text-sm text-[#39483f]">
                    Nome mostrato nel form:{" "}
                    <span className="font-medium">
                      {group.publicLabel ?? "non impostata"}
                    </span>
                  </p>

                  {createdUrl && createdGroupId === group.id ? (
                    <label className="mt-4 grid gap-2 text-sm font-semibold text-[#3c4b40]">
                      Link appena generato
                      <input
                        readOnly
                        className="field bg-white font-mono text-xs"
                        value={createdUrl}
                      />
                    </label>
                  ) : null}

                  <div className="mt-4 grid gap-2">
                    {groupLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex flex-col gap-2 rounded-md border border-[#e1e6da] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-[#1c241f]">
                            {link.internalLabel ?? link.publicLabel ?? "Link senza etichetta"}
                          </p>
                          <p className="mt-1 text-xs text-[#5e6d63]">
                            {groupLinkStatusLabel(link)} - usi {link.useCount}
                            {link.maxUses ? `/${link.maxUses}` : ""}
                          </p>
                        </div>
                        <form action={revokeGroupRegistrationLink}>
                          <input type="hidden" name="sourceDashboard" value="capogruppo" />
                          <input type="hidden" name="linkId" value={link.id} />
                          <button className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-xs font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]">
                            Revoca
                          </button>
                        </form>
                      </div>
                    ))}
                    {groupLinks.length === 0 ? (
                      <p className="text-sm text-[#5e6d63]">Nessun link attivo.</p>
                    ) : null}
                  </div>
                </div>

                <form action={createGroupRegistrationLink} className="grid gap-3">
                  <input type="hidden" name="sourceDashboard" value="capogruppo" />
                  <input type="hidden" name="groupId" value={group.id} />
                  <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
                    Nome mostrato a chi si iscrive
                    <input
                      name="publicLabel"
                      className="field"
                      defaultValue={group.publicLabel ?? ""}
                      placeholder={group.name}
                    />
                    <span className="text-xs font-normal leading-5 text-[#5e6d63]">
                      Opzionale. Se compilato, chi apre questo link vedrà questo
                      nome invece del nome interno del gruppo.
                    </span>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
                    Promemoria per te
                    <input
                      name="internalLabel"
                      className="field"
                      placeholder="Per esempio: link mandato su WhatsApp"
                    />
                    <span className="text-xs font-normal leading-5 text-[#5e6d63]">
                      Non viene mostrato ai partecipanti. Serve solo a
                      riconoscere questo link in dashboard.
                    </span>
                  </label>
                  <button className="min-h-10 rounded-md bg-[#315c44] px-3 text-sm font-semibold text-white transition hover:bg-[#264a36]">
                    Genera link
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {assignableGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[#5e6d63]">
          Nessun gruppo gestito può ricevere iscrizioni in questo momento.
        </p>
      ) : null}
    </section>
  );
}

function ManualRegistrationSection({
  groups,
  selectedGroupId,
  eventDays,
}: {
  groups: ScopedGroupView[];
  selectedGroupId: string | null;
  eventDays: Array<{ value: string; label: string }>;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const defaultGroupId =
    selectedGroupId && assignableGroups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : "";

  return (
    <section>
      <div>
        <h2 className="text-lg font-semibold">Inserimento manuale</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
          Aggiungi una persona direttamente a uno dei gruppi che gestisci. La
          persona risulta subito confermata nel gruppo scelto.
        </p>
      </div>

      {assignableGroups.length > 0 ? (
        <form
          action={createGroupLeaderManualRegistration}
          className="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40] lg:col-span-2">
            Gruppo
            <select name="groupId" required className="field" defaultValue={defaultGroupId}>
              <option value="">Seleziona gruppo</option>
              {assignableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Nome
            <input name="firstName" required minLength={2} className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Cognome
            <input name="lastName" required minLength={2} className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Email
            <input name="email" type="email" className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Telefono
            <input name="phone" className="field" placeholder="+393331234567" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Data di nascita
            <input name="birthDate" type="date" className="field" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
            Lingua
            <select name="preferredLocale" className="field" defaultValue="it">
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          <ManualAttendanceFields eventDays={eventDays} />
          <ManualAccessibilityFields />
          <label className="grid gap-1 text-sm font-semibold text-[#3c4b40] lg:col-span-2">
            Nota interna
            <textarea
              name="leaderNote"
              rows={3}
              className="min-h-20 rounded-md border border-[#cfd8c4] bg-white px-3 py-2 text-sm font-normal text-[#1c241f] outline-none transition focus:border-[#56745d]"
            />
          </label>
          <label className="flex gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-3 text-sm font-medium text-[#39483f] lg:col-span-2">
            <input
              name="consentConfirmed"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 accent-[#315c44]"
            />
            Ho il consenso della persona iscritta al trattamento dei dati per
            questa iscrizione.
          </label>
          <div className="lg:col-span-2">
            <button className="min-h-10 rounded-md bg-[#315c44] px-4 text-sm font-semibold text-white transition hover:bg-[#264a36]">
              Inserisci partecipante
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[#5e6d63]">
          Nessun gruppo gestito può ricevere iscrizioni in questo momento.
        </p>
      )}
    </section>
  );
}

function AssignmentFilters({
  filter,
  query,
  sort,
}: {
  filter: GroupLeaderReviewFilter;
  query: string;
  sort: AssignmentSort;
}) {
  return (
    <form
      method="get"
      action="/dashboard/capogruppo"
      className="mt-5 grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:grid-cols-[1fr_190px_210px_auto]"
    >
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Cerca partecipante
        <input
          name="q"
          defaultValue={query}
          className="field bg-white"
          placeholder="Nome, email, telefono, codice"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Stato
        <select name="filter" defaultValue={filter} className="field bg-white">
          {Object.entries(FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Ordina per
        <select name="sort" defaultValue={sort} className="field bg-white">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button className="min-h-11 rounded-md bg-[#315c44] px-4 text-sm font-semibold text-white transition hover:bg-[#264a36]">
          Applica
        </button>
        <Link
          href="/dashboard/capogruppo#assegnazioni-gruppo"
          className="inline-flex min-h-11 items-center rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
        >
          Azzera
        </Link>
      </div>
    </form>
  );
}

function AssignmentsTable({ assignments }: { assignments: AssignmentView[] }) {
  if (assignments.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 text-sm text-[#5e6d63]">
        Nessun partecipante con questi filtri.
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-md border border-[#e1e6da]">
      <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#dfe5d8] bg-[#fbfcf8] text-xs uppercase tracking-wide text-[#66745f]">
            <th className="py-3 pl-4 pr-4 font-semibold">Partecipante</th>
            <th className="py-3 pr-4 font-semibold">Contatti</th>
            <th className="py-3 pr-4 font-semibold">Gruppo</th>
            <th className="py-3 pr-4 font-semibold">Provenienza</th>
            <th className="py-3 pr-4 font-semibold">Iscrizione</th>
            <th className="py-3 pr-4 font-semibold">Stato</th>
            <th className="py-3 pr-4 font-semibold">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => (
            <AssignmentRowView key={assignment.id} assignment={assignment} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentRowView({ assignment }: { assignment: AssignmentView }) {
  const canDecide = assignment.isCurrent && assignment.status === "probable";
  const manageLabel = `Gestisci ${assignment.participantName}${
    assignment.participantCode ? ` ${assignment.participantCode}` : ""
  }`;

  return (
    <tr className="border-b border-[#edf1e8] align-top last:border-b-0">
      <td className="py-4 pl-4 pr-4">
        <p className="font-semibold text-[#1c241f]">{assignment.participantName}</p>
        <p className="mt-1 text-xs text-[#5e6d63]">
          {assignment.participantCode ?? "Senza codice"}
          {assignment.birthDate ? ` - nato/a il ${formatDate(assignment.birthDate)}` : ""}
        </p>
      </td>
      <td className="py-4 pr-4 text-[#39483f]">
        <p>{assignment.participantEmail ?? "Email non indicata"}</p>
        <p className="mt-1 text-xs text-[#5e6d63]">
          {assignment.participantPhone ?? "Telefono non indicato"}
        </p>
      </td>
      <td className="py-4 pr-4">
        <p className="font-medium text-[#1c241f]">{assignment.groupName}</p>
        <p className="mt-1 text-xs text-[#5e6d63]">
          {assignment.assignmentReason
            ? assignmentReasonLabel(assignment.assignmentReason)
            : sourceLabel(assignment.source)}
        </p>
      </td>
      <td className="py-4 pr-4 text-[#39483f]">{assignment.participantPlace}</td>
      <td className="py-4 pr-4 text-[#39483f]">
        <p>{formatDateTime(assignment.submittedAt)}</p>
        <p className="mt-1 text-xs text-[#5e6d63]">
          aggiornata {formatDateTime(assignment.updatedAt)}
        </p>
      </td>
      <td className="py-4 pr-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={assignment.status} isCurrent={assignment.isCurrent} />
          {!assignment.leaderNotificationReadAt && canDecide ? (
            <span className="rounded-full bg-[#fff1c2] px-2.5 py-1 text-xs font-semibold text-[#6b5214]">
              Da leggere
            </span>
          ) : null}
        </div>
      </td>
      <td className="py-4 pr-4">
        <details className="group">
          <summary
            aria-label={manageLabel}
            className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
          >
            Gestisci
          </summary>
          <form
            action={updateGroupLeaderAssignment}
            className="mt-3 grid min-w-[260px] gap-2 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-3"
          >
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#66745f]">
              Nota interna
              <textarea
                name="leaderInternalNote"
                defaultValue={assignment.leaderInternalNote ?? ""}
                rows={3}
                className="min-h-20 rounded-md border border-[#cfd8c4] bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#1c241f] outline-none transition focus:border-[#56745d]"
              />
            </label>
            <button
              name="intent"
              value="note"
              className="min-h-9 rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
            >
              Salva nota
            </button>
            {canDecide ? (
              <>
                <button
                  name="intent"
                  value="confirm"
                  className="min-h-9 rounded-md bg-[#315c44] px-3 text-sm font-semibold text-white transition hover:bg-[#264a36]"
                >
                  Conferma
                </button>
                <button
                  name="intent"
                  value="reject"
                  className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-sm font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]"
                >
                  Non riconosciuto
                </button>
                <button
                  name="intent"
                  value="read"
                  className="min-h-9 rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#516356] transition hover:bg-[#eef2e7]"
                >
                  Segna letta
                </button>
              </>
            ) : null}
          </form>
        </details>
      </td>
    </tr>
  );
}

function ScopeBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "green" | "neutral" | "red";
}) {
  const className =
    tone === "green"
      ? "border-[#bad2b8] bg-[#edf7ea] text-[#2f6541]"
      : tone === "red"
        ? "border-[#e0b6af] bg-[#fff0ee] text-[#8a3f35]"
        : "border-[#c8d5be] bg-white text-[#516356]";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function StatusBadge({
  status,
  isCurrent,
}: {
  status: string | null;
  isCurrent: boolean;
}) {
  const label = statusLabel(status, isCurrent);
  const className =
    status === "confirmed" && isCurrent
      ? "bg-[#e6f3e8] text-[#2f6541]"
      : status === "rejected"
        ? "bg-[#f8e8e5] text-[#8a3f35]"
        : "bg-[#fff1c2] text-[#6b5214]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function StatusMessage({
  error,
  saved,
}: {
  error: string | undefined;
  saved: string | undefined;
}) {
  if (saved) {
    return (
      <div className="rounded-lg border border-[#bad2b8] bg-[#edf7ea] p-4 text-sm text-[#2f6541]">
        Aggiornamento salvato.
      </div>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e0b6af] bg-[#fff0ee] p-4 text-sm text-[#8a3f35]">
      Operazione non completata: {error}.
    </div>
  );
}

function toAssignmentView(row: AssignmentRow): AssignmentView | null {
  const registration = relatedOne(row.registrations);
  const participant = relatedOne(registration?.participants ?? null);
  const group = relatedOne(row.groups);

  if (!registration || !participant || !group) {
    return null;
  }

  return {
    id: row.id,
    registrationId: row.registration_id,
    groupId: row.group_id,
    groupName: group.name ?? "Gruppo senza nome",
    groupNodeType: group.node_type,
    participantName: formatParticipantName(participant.first_name, participant.last_name),
    participantCode: participant.public_code,
    participantEmail: getPrimaryContact(participant.participant_contacts)?.email ?? null,
    participantPhone: getPrimaryContact(participant.participant_contacts)?.phone ?? null,
    participantPlace: formatPlace(
      relatedOne(participant.cities)?.name ?? participant.city_other,
      relatedOne(participant.countries)?.name_it ?? participant.country_other
    ),
    birthDate: participant.birth_date,
    registrationStatus: registration.status,
    submittedAt: registration.submitted_at,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    isCurrent: row.is_current ?? true,
    assignmentReason: row.assignment_reason,
    escalationDepth: row.escalation_depth ?? 0,
    leaderInternalNote: row.leader_internal_note,
    leaderNotificationReadAt: row.leader_notification_read_at,
    leaderDecisionAt: row.leader_decision_at,
    updatedAt: row.updated_at,
  };
}

function formatParticipantName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return name || "Partecipante senza nome";
}

function getPrimaryContact(
  contacts:
    | Array<{
        email: string | null;
        phone: string | null;
        is_primary: boolean | null;
      }>
    | null
): { email: string | null; phone: string | null } | null {
  if (!contacts || contacts.length === 0) {
    return null;
  }

  return contacts.find((contact) => contact.is_primary) ?? contacts[0] ?? null;
}

function formatPlace(city: string | null, country: string | null): string {
  const parts = [city, country].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Non indicata";
}

function statusLabel(status: string | null, isCurrent: boolean): string {
  if (status === "confirmed" && isCurrent) {
    return "Confermato";
  }

  if (status === "rejected") {
    return "Rifiutato";
  }

  if (!isCurrent) {
    return "Superato";
  }

  return "Probabile";
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case "participant_selected":
      return "Scelta partecipante";
    case "rule":
      return "Regola";
    case "capogruppo":
      return "Referente";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
    default:
      return "Non indicata";
  }
}

function assignmentReasonLabel(reason: string): string {
  switch (reason) {
    case "participant_selected_group":
      return "gruppo indicato nel form";
    case "group_registration_link":
      return "link riservato di iscrizione";
    case "newcomer_territorial_fallback":
      return "nuovo partecipante assegnato per territorio";
    case "participant_cannot_find_leader":
      return "referente non trovato nel form";
    case "santegidio_territorial_fallback":
      return "assegnazione territoriale probabile";
    case "group_leader_rejected_escalated_to_parent":
      return "rifiuto risalito al nodo superiore";
    case "group_leader_manual_entry":
      return "inserimento manuale del referente";
    case "admin_updated_group":
      return "assegnato da admin";
    case "manager_updated_group":
      return "assegnato da manager";
    case "capogruppo_updated_group":
      return "assegnato dal referente";
    default:
      return reason;
  }
}

function groupLinkStatusLabel(link: GroupLinkView): string {
  switch (
    getGroupRegistrationLinkStatus({
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      maxUses: link.maxUses,
      useCount: link.useCount,
    })
  ) {
    case "active":
      return `Attivo dal ${formatDateTime(link.createdAt)}`;
    case "expired":
      return "Scaduto";
    case "revoked":
      return "Revocato";
    case "exhausted":
      return "Usi esauriti";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Non indicata";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function normalizeSearchQuery(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function parseAssignmentSort(value: string | null | undefined): AssignmentSort {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as AssignmentSort)
    : "name";
}

function parseDashboardTool(value: string | null | undefined): DashboardTool | null {
  return value === "link" || value === "manual" ? value : null;
}

function dashboardToolTitle(tool: DashboardTool): string {
  return tool === "link" ? "Genera link iscrizione" : "Inserisci partecipante";
}

function matchesAssignmentQuery(
  assignment: AssignmentView,
  query: string
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  const haystack = [
    assignment.participantName,
    assignment.participantCode,
    assignment.participantEmail,
    assignment.participantPhone,
    assignment.groupName,
    assignment.participantPlace,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortAssignments(
  assignments: AssignmentView[],
  sort: AssignmentSort
): AssignmentView[] {
  return [...assignments].sort((left, right) => {
    switch (sort) {
      case "updated":
        return compareDateDesc(left.updatedAt, right.updatedAt);
      case "submitted":
        return compareDateDesc(left.submittedAt, right.submittedAt);
      case "status":
        return (
          statusSortValue(left) - statusSortValue(right) ||
          left.participantName.localeCompare(right.participantName, "it")
        );
      case "name":
        return left.participantName.localeCompare(right.participantName, "it");
    }
  });
}

function compareDateDesc(left: string | null, right: string | null): number {
  return dateTimeValue(right) - dateTimeValue(left);
}

function dateTimeValue(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function statusSortValue(assignment: AssignmentView): number {
  if (assignment.status === "probable" && assignment.isCurrent) {
    return assignment.leaderNotificationReadAt ? 1 : 0;
  }

  if (assignment.status === "confirmed" && assignment.isCurrent) {
    return 2;
  }

  if (assignment.status === "rejected") {
    return 3;
  }

  return 4;
}

function getManualRegistrationEventDays(
  groups: ScopedGroupView[]
): Array<{ value: string; label: string }> {
  const event = groups.find((group) => group.eventStartsOn);

  if (!event?.eventStartsOn) {
    return [];
  }

  const start = parseDateOnly(event.eventStartsOn);
  const end = parseDateOnly(event.eventEndsOn ?? event.eventStartsOn);

  if (!start || !end || end.getTime() < start.getTime()) {
    return [];
  }

  const days: Array<{ value: string; label: string }> = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + DAY_IN_MS)
  ) {
    days.push({
      value: cursor.toISOString().slice(0, 10),
      label: EVENT_DAY_FORMATTER.format(cursor),
    });
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

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
