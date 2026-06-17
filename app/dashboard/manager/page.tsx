import Link from "next/link";
import { CalendarDays, Network, Users } from "lucide-react";
import { redirect } from "next/navigation";

import {
  assignGroupLeader,
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  saveOperationsGroup,
  updateEventOpeningState,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext, type EventUserRole } from "@/lib/auth/session";
import {
  buildGroupRegistrationUrl,
  getGroupRegistrationLinkStatus,
} from "@/lib/groups/registration-links";
import {
  getOpeningState,
  openingStateLabel,
  summarizeRegistrationMonitoring,
  type RegistrationMonitoringInput,
  type RegistrationMonitoringSummary,
} from "@/lib/registrations/opening-monitoring";
import {
  applyOperationsDashboardFilters,
  hasActiveOperationsDashboardFilters,
  parseOperationsDashboardFilters,
  summarizeOperationsDashboardParticipants,
  type OperationsDashboardFilters,
  type OperationsDashboardSummary,
} from "@/lib/registrations/operations-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type ManagerPageProps = {
  searchParams: Promise<{
    openingError?: string;
    openingSaved?: string;
    managerError?: string;
    managerSaved?: string;
    groupLinkError?: string;
    groupLinkSaved?: string;
    groupLinkToken?: string;
    groupLinkGroupId?: string;
    groupError?: string;
    groupEvent?: string;
    groupId?: string;
    groupQ?: string;
    groupSaved?: string;
    groupTool?: string;
    groupType?: string;
    groupVisibility?: string;
    edit?: string;
    editMode?: string;
    event?: string;
    group?: string;
    q?: string;
    nav?: string;
    section?: string;
    status?: string;
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
  phone?: string | null;
};

type ManagerRegistrationRow = {
  id: string;
  event_id: string;
  participant_id: string;
  status: string | null;
  submitted_at: string | null;
  events:
    | { title: string | null }
    | Array<{ title: string | null }>
    | null;
  participants:
    | {
        id: string;
        auth_user_id: string | null;
        first_name: string | null;
        last_name: string | null;
        public_code: string | null;
        country_other: string | null;
        city_other: string | null;
      }
    | Array<{
        id: string;
        auth_user_id: string | null;
        first_name: string | null;
        last_name: string | null;
        public_code: string | null;
        country_other: string | null;
        city_other: string | null;
      }>
    | null;
};

type ManagerCurrentAssignmentRow = {
  registration_id: string;
  group_id: string;
  status: string | null;
  groups:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
};

type ManagerGroupOption = {
  id: string;
  eventId: string;
  name: string;
};

type ManagerGroupTreeRow = {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  parentGroupId: string | null;
  parentName: string | null;
  nodeType: string | null;
  communityKind: string | null;
  ageBracket: string | null;
  isActive: boolean | null;
  isAssignable: boolean | null;
  isPublicCatalog: boolean | null;
  publicOrder: number | null;
  primaryLeaderName: string | null;
  publicLabel: string | null;
};

type GroupTableFilters = {
  q: string;
  eventId: string;
  nodeType: string;
  visibility: string;
};

type ManagerGroupRegistrationLinkRow = {
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

type ManagerGroupRegistrationLink = {
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

type ManagerParticipantRow = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  authUserId: string | null;
  name: string;
  publicCode: string | null;
  place: string;
  email: string | null;
  phone: string | null;
  registrationStatus: string | null;
  submittedAt: string | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupStatus: string | null;
};

type ManagerOperationsSnapshot = {
  participants: ManagerParticipantRow[];
  allParticipants: ManagerParticipantRow[];
  groupOptions: ManagerGroupOption[];
  groupTree: ManagerGroupTreeRow[];
  groupLinks: ManagerGroupRegistrationLink[];
  filters: OperationsDashboardFilters;
  summary: OperationsDashboardSummary;
};

type EventSnapshot = {
  event: EventRow;
  openingState: ReturnType<typeof getOpeningState>;
  summary: RegistrationMonitoringSummary;
  emailErrorsLast24Hours: number;
  canManage: boolean;
};

type ManagerSection = "evento" | "iscritti" | "gruppi";
type ManagerNavMode = "full" | "mini";

export default async function ManagerDashboardPage({
  searchParams,
}: ManagerPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "manager");

  if (!auth) {
    redirect("/login");
  }

  const scope = getManagerEventScope(auth.eventRoles);

  if (!scope.canSeeDashboard) {
    redirect("/login");
  }

  const serviceSupabase = createSupabaseServiceClient();
  const filters = parseOperationsDashboardFilters(params);
  const [snapshots, managerOperations] = await Promise.all([
    getOpeningSnapshots(serviceSupabase, scope),
    getManagerOperationsSnapshot(serviceSupabase, scope, filters),
  ]);
  const selectedParticipant =
    managerOperations.allParticipants.find(
      (participant) => participant.registrationId === params.edit
    ) ?? null;
  const selectedCanManage = selectedParticipant
    ? scope.canManageEvent(selectedParticipant.eventId)
    : false;
  const selectedGroup =
    managerOperations.groupTree.find((group) => group.id === params.groupId) ??
    null;
  const activeSection = resolveManagerSection(params);
  const navMode: ManagerNavMode = params.nav === "mini" ? "mini" : "full";

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <section className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard manager</h1>
          <DashboardRoleTabs activeRole="manager" eventRoles={auth.eventRoles} />
          <DashboardAreaDescription>
            In questa area puoi seguire apertura, iscrizioni, gruppi e ruoli
            operativi degli eventi assegnati.
          </DashboardAreaDescription>
        </header>

        <div
          className={[
            "grid gap-4 lg:items-start",
            navMode === "mini" ? "lg:grid-cols-[4.75rem_1fr]" : "lg:grid-cols-[11.5rem_1fr]",
          ].join(" ")}
        >
          <ManagerSidebar activeSection={activeSection} navMode={navMode} />

          <div className="grid min-w-0 gap-6">
            <StatusMessage
              error={params.openingError}
              saved={params.openingSaved}
              managerError={params.managerError}
              managerSaved={params.managerSaved}
              groupLinkError={params.groupLinkError}
              groupLinkSaved={params.groupLinkSaved}
              groupError={params.groupError}
              groupSaved={params.groupSaved}
            />

            {activeSection === "evento" ? (
              <ManagerEventSection snapshots={snapshots} />
            ) : null}

            {activeSection === "iscritti" ? (
              <ManagerParticipantsSection
                snapshot={managerOperations}
                selectedParticipant={selectedCanManage ? selectedParticipant : null}
                isEditingParticipant={params.editMode === "1"}
                canManageEvent={scope.canManageEvent}
                navMode={navMode}
              />
            ) : null}

            {activeSection === "gruppi" ? (
              <ManagerGroupTreeSection
                groups={managerOperations.groupTree}
                links={managerOperations.groupLinks}
                participants={managerOperations.allParticipants}
                canManageEvent={scope.canManageEvent}
                filters={parseGroupTableFilters(params)}
                selectedGroup={selectedGroup}
                selectedTool={
                  params.groupTool === "links"
                    ? "links"
                    : params.groupTool === "edit"
                      ? "edit"
                      : params.groupTool === "leaders"
                        ? "leaders"
                        : null
                }
                createdGroupId={params.groupLinkGroupId ?? null}
                createdUrl={
                  params.groupLinkToken
                    ? buildGroupRegistrationUrl({
                        appUrl: getAppUrl(),
                        token: params.groupLinkToken,
                      })
                    : null
                }
                navMode={navMode}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function ManagerSidebar({
  activeSection,
  navMode,
}: {
  activeSection: ManagerSection;
  navMode: ManagerNavMode;
}) {
  const isMini = navMode === "mini";
  const nextMode = isMini ? "full" : "mini";
  const toggleLabel = isMini ? "Espandi menu" : "Comprimi menu";
  const items: Array<{
    key: ManagerSection;
    href: string;
    Icon: typeof CalendarDays;
    label: string;
    help: string;
  }> = [
    {
      key: "evento",
      href: `/dashboard/manager?section=evento&nav=${navMode}`,
      Icon: CalendarDays,
      label: "Evento",
      help: "Apertura e monitoraggio",
    },
    {
      key: "iscritti",
      href: `/dashboard/manager?section=iscritti&nav=${navMode}`,
      Icon: Users,
      label: "Gestione iscritti",
      help: "Partecipanti e ruoli",
    },
    {
      key: "gruppi",
      href: `/dashboard/manager?section=gruppi&nav=${navMode}`,
      Icon: Network,
      label: "Gruppi",
      help: "Albero e link riservati",
    },
  ];

  return (
    <aside className="surface-card lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--peace-border)] p-2">
        <span className={isMini ? "sr-only" : "px-2 text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]"}>
          Manager
        </span>
        <Link
          href={`/dashboard/manager?section=${activeSection}&nav=${nextMode}`}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="btn-secondary grid min-h-9 min-w-9 place-items-center px-2 text-sm"
        >
          <span aria-hidden="true">{isMini ? "›" : "‹"}</span>
        </Link>
      </div>
      <nav aria-label="Sezioni dashboard manager" className="grid gap-1.5 p-2">
        {items.map((item) => {
          const isActive = item.key === activeSection;
          const Icon = item.Icon;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={isMini ? item.label : undefined}
              className={[
                isMini
                  ? "grid min-h-12 place-items-center rounded-[var(--radius-md)] px-2 py-2 text-center transition"
                  : "grid rounded-[var(--radius-md)] px-3 py-2.5 text-left transition",
                "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                isActive
                  ? "bg-[var(--peace-blue-800)] text-white shadow-sm"
                  : "text-[var(--peace-ink)] hover:bg-[var(--peace-sky-100)]",
                ].join(" ")}
            >
              {isMini ? (
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
              ) : (
                <>
                  <span className="text-sm font-bold">{item.label}</span>
                  <span
                    className={[
                      "mt-0.5 text-[0.7rem] leading-4",
                      isActive ? "text-white/78" : "text-[var(--peace-muted)]",
                    ].join(" ")}
                  >
                    {item.help}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function managerPath(section: ManagerSection, navMode: ManagerNavMode): string {
  return `/dashboard/manager?section=${section}&nav=${navMode}`;
}

function ManagerEventSection({ snapshots }: { snapshots: EventSnapshot[] }) {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="surface-panel p-5">
        <h2 className="text-lg font-semibold">Evento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          I manager possono aprire o sospendere le iscrizioni degli eventi
          assegnati. I manager viewer consultano soltanto i dati.
        </p>
      </div>

      {snapshots.map((snapshot) => (
        <EventOpeningCard key={snapshot.event.id} snapshot={snapshot} />
      ))}

      {snapshots.length === 0 ? (
        <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5 text-sm text-[var(--peace-muted)]">
          Nessun evento manager assegnato a questo utente.
        </div>
      ) : null}
    </section>
  );
}

function getManagerEventScope(eventRoles: EventUserRole[]) {
  const isAdmin = eventRoles.some((role) => role.role === "admin");
  const managerEventIds = new Set(
    eventRoles
      .filter((role) => role.role === "manager")
      .map((role) => role.eventId)
      .filter((eventId): eventId is string => Boolean(eventId))
  );
  const visibleEventIds = new Set(
    eventRoles
      .filter((role) => role.role === "manager" || role.role === "manager_viewer")
      .map((role) => role.eventId)
      .filter((eventId): eventId is string => Boolean(eventId))
  );

  return {
    canSeeDashboard: isAdmin || visibleEventIds.size > 0,
    eventIds: isAdmin ? null : visibleEventIds,
    canManageEvent: (eventId: string) => isAdmin || managerEventIds.has(eventId),
  };
}

function resolveManagerSection(params: Awaited<ManagerPageProps["searchParams"]>): ManagerSection {
  if (params.section === "evento" || params.section === "iscritti" || params.section === "gruppi") {
    return params.section;
  }

  if (
    params.groupTool ||
    params.groupId ||
    params.groupQ ||
    params.groupEvent ||
    params.groupType ||
    params.groupVisibility ||
    params.groupError ||
    params.groupSaved ||
    params.groupLinkError ||
    params.groupLinkSaved ||
    params.groupLinkGroupId ||
    params.groupLinkToken
  ) {
    return "gruppi";
  }

  if (
    params.edit ||
    params.q ||
    params.event ||
    params.group ||
    params.status ||
    params.managerError ||
    params.managerSaved
  ) {
    return "iscritti";
  }

  return "evento";
}

async function getManagerOperationsSnapshot(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  scope: ReturnType<typeof getManagerEventScope>,
  filters: OperationsDashboardFilters
): Promise<ManagerOperationsSnapshot> {
  const registrationsQuery = supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,submitted_at,events(title),participants(id,auth_user_id,first_name,last_name,public_code,country_other,city_other)"
    )
    .order("submitted_at", { ascending: false })
    .limit(200);
  const groupsQuery = supabase
    .from("groups")
    .select("id,event_id,name,is_assignable,is_active")
    .eq("is_active", true)
    .eq("is_assignable", true)
    .order("name", { ascending: true });

  if (scope.eventIds) {
    const eventIds = [...scope.eventIds];
    registrationsQuery.in("event_id", eventIds);
    groupsQuery.in("event_id", eventIds);
  }

  const groupTreeQuery = supabase
    .from("groups")
    .select(
      "id,event_id,name,public_label,parent_group_id,node_type,community_kind,age_bracket,is_active,is_assignable,is_public_catalog,primary_leader_name,public_order,events(title)"
    )
    .eq("is_active", true)
    .order("public_order", { ascending: true })
    .order("name", { ascending: true });

  if (scope.eventIds) {
    groupTreeQuery.in("event_id", [...scope.eventIds]);
  }

  const groupLinksQuery = supabase
    .from("group_registration_links")
    .select(
      "id,event_id,group_id,public_label,internal_label,use_count,max_uses,created_at,expires_at,revoked_at"
    )
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (scope.eventIds) {
    groupLinksQuery.in("event_id", [...scope.eventIds]);
  }

  const [
    { data: registrations },
    { data: groups },
    { data: groupTree },
    { data: groupLinks },
  ] = await Promise.all([
    scope.eventIds?.size === 0 ? Promise.resolve({ data: [] }) : registrationsQuery,
    scope.eventIds?.size === 0 ? Promise.resolve({ data: [] }) : groupsQuery,
    scope.eventIds?.size === 0 ? Promise.resolve({ data: [] }) : groupTreeQuery,
    scope.eventIds?.size === 0 ? Promise.resolve({ data: [] }) : groupLinksQuery,
  ]);
  const registrationRows = (registrations ?? []) as ManagerRegistrationRow[];
  const registrationIds = registrationRows.map((row) => row.id);
  const participantIds = registrationRows.map((row) => row.participant_id);
  const emptyResult = { data: [] };
  const [{ data: contacts }, { data: assignments }] = await Promise.all([
    participantIds.length > 0
      ? supabase
          .from("participant_contacts")
          .select("participant_id,email,phone")
          .in("participant_id", participantIds)
          .eq("is_primary", true)
      : Promise.resolve(emptyResult),
    registrationIds.length > 0
      ? supabase
          .from("participant_group_assignments")
          .select(
            "registration_id,group_id,status,groups!participant_group_assignments_group_id_fkey(name)"
          )
          .in("registration_id", registrationIds)
          .eq("is_current", true)
      : Promise.resolve(emptyResult),
  ]);
  const contactByParticipantId = new Map(
    ((contacts ?? []) as ContactRow[]).map((row) => [row.participant_id, row])
  );
  const assignmentByRegistrationId = new Map(
    ((assignments ?? []) as ManagerCurrentAssignmentRow[]).map((row) => [
      row.registration_id,
      row,
    ])
  );
  const groupTreeRows = (groupTree ?? []) as Array<{
    id: string;
    event_id: string;
    name: string | null;
    parent_group_id: string | null;
    node_type: string | null;
    community_kind: string | null;
    age_bracket: string | null;
    is_active: boolean | null;
    is_assignable: boolean | null;
    is_public_catalog: boolean | null;
    public_order: number | null;
    primary_leader_name: string | null;
    public_label: string | null;
    events:
      | { title: string | null }
      | Array<{ title: string | null }>
      | null;
  }>;
  const groupNameById = new Map(
    groupTreeRows.map((group) => [group.id, group.name ?? "Gruppo senza nome"])
  );

  const participantRows = registrationRows.map((registration) => {
      const participant = relatedOne(registration.participants);
      const event = relatedOne(registration.events);
      const contact = contactByParticipantId.get(registration.participant_id);
      const assignment = assignmentByRegistrationId.get(registration.id);
      const group = relatedOne(assignment?.groups ?? null);
      const authUserId = participant?.auth_user_id ?? null;

      return {
        registrationId: registration.id,
        eventId: registration.event_id,
        eventTitle: event?.title ?? "Evento",
        participantId: registration.participant_id,
        authUserId,
        name: formatParticipantName(
          participant?.first_name ?? null,
          participant?.last_name ?? null
        ),
        publicCode: participant?.public_code ?? null,
        place: formatPlace(participant?.city_other ?? null, participant?.country_other ?? null),
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        registrationStatus: registration.status,
        submittedAt: registration.submitted_at,
        currentGroupId: assignment?.group_id ?? null,
        currentGroupName: group?.name ?? null,
        currentGroupStatus: assignment?.status ?? null,
      };
    });
  const filteredParticipants = applyOperationsDashboardFilters(
    participantRows,
    filters
  );

  return {
    participants: filteredParticipants,
    allParticipants: participantRows,
    groupOptions: ((groups ?? []) as Array<{
      id: string;
      event_id: string;
      name: string | null;
    }>).map((group) => ({
      id: group.id,
      eventId: group.event_id,
      name: group.name ?? "Gruppo senza nome",
    })),
    groupTree: groupTreeRows.map((group) => ({
      id: group.id,
      eventId: group.event_id,
      eventTitle: relatedOne(group.events)?.title ?? "Evento",
      name: group.name ?? "Gruppo senza nome",
      parentGroupId: group.parent_group_id,
      parentName: group.parent_group_id
        ? groupNameById.get(group.parent_group_id) ?? null
        : null,
      nodeType: group.node_type,
      communityKind: group.community_kind,
      ageBracket: group.age_bracket,
      isActive: group.is_active,
      isAssignable: group.is_assignable,
      isPublicCatalog: group.is_public_catalog,
      publicOrder: group.public_order,
      primaryLeaderName: group.primary_leader_name,
      publicLabel: group.public_label,
    })),
    groupLinks: ((groupLinks ?? []) as ManagerGroupRegistrationLinkRow[]).map(
      (link) => ({
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
      })
    ),
    filters,
    summary: summarizeOperationsDashboardParticipants(
      participantRows,
      filteredParticipants
    ),
  };
}

async function getOpeningSnapshots(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  scope: ReturnType<typeof getManagerEventScope>
): Promise<EventSnapshot[]> {
  const eventsQuery = supabase
    .from("events")
    .select(
      "id,slug,title,status,city,country,starts_on,ends_on,registration_opens_at,registration_closes_at"
    )
    .order("starts_on", { ascending: false });

  if (scope.eventIds) {
    eventsQuery.in("id", [...scope.eventIds]);
  }

  const { data: events } =
    scope.eventIds?.size === 0 ? { data: [] } : await eventsQuery;

  return Promise.all(
    ((events ?? []) as EventRow[]).map((event) =>
      getEventSnapshot(supabase, event, scope.canManageEvent(event.id))
    )
  );
}

async function getEventSnapshot(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  event: EventRow,
  canManage: boolean
): Promise<EventSnapshot> {
  const { data: registrations } = await supabase
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
      ? supabase
          .from("participant_group_assignments")
          .select("registration_id,status,source,is_current,assignment_reason")
          .in("registration_id", registrationIds)
          .eq("is_current", true)
      : Promise.resolve(emptyResult),
    registrationIds.length > 0
      ? supabase.from("qr_tokens").select("registration_id").in("registration_id", registrationIds)
      : Promise.resolve(emptyResult),
    registrationIds.length > 0
      ? supabase
          .from("accessibility_needs")
          .select("registration_id,needs_operational_support")
          .in("registration_id", registrationIds)
      : Promise.resolve(emptyResult),
    participantIds.length > 0
      ? supabase
          .from("participant_contacts")
          .select("participant_id,email")
          .in("participant_id", participantIds)
          .eq("is_primary", true)
      : Promise.resolve(emptyResult),
    supabase
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
    canManage,
  };
}

function EventOpeningCard({ snapshot }: { snapshot: EventSnapshot }) {
  const { event, summary } = snapshot;

  return (
    <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{event.title}</h3>
            <span className="rounded-full border border-[var(--peace-border-strong)] bg-[var(--peace-sky-100)] px-3 py-1 text-xs font-semibold text-[var(--peace-blue-800)]">
              {openingStateLabel(snapshot.openingState)}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--peace-muted)]">
            {event.city}, {event.country} - {event.slug}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Evento" value={formatDateRange(event.starts_on, event.ends_on)} />
            <Info label="Apre" value={formatDateTime(event.registration_opens_at)} />
            <Info label="Chiude" value={formatDateTime(event.registration_closes_at)} />
          </dl>
        </div>

        {snapshot.canManage ? (
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
        ) : (
          <p className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-4 py-3 text-sm text-[var(--peace-muted)]">
            Consultazione senza permessi di modifica.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EventValue label="Iscrizioni" value={summary.total} />
        <EventValue label="Ultime 24 ore" value={summary.last24Hours} />
        <EventValue label="Assegnazioni da verificare" value={summary.probableGroup} />
        <EventValue label="Supporto richiesto" value={summary.needsOperationalSupport} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <WatchItem label="Senza gruppo corrente" value={summary.withoutCurrentGroup} />
        <WatchItem label="QR mancante" value={summary.missingQrToken} />
        <WatchItem label="Email fallite 24h" value={snapshot.emailErrorsLast24Hours} />
        <WatchItem label="Email duplicate" value={summary.duplicateContactEmails} />
      </div>

      <p className="mt-4 text-sm text-[var(--peace-muted)]">
        Scelte gruppo: {summary.participantSelectedGroup} dichiarate,
        {` ${summary.ruleMatchedGroup}`} da regola, {summary.newcomerGroup} nuovi
        partecipanti.
      </p>
    </article>
  );
}

function ManagerGroupTreeSection({
  groups,
  links,
  participants,
  canManageEvent,
  filters,
  selectedGroup,
  selectedTool,
  createdGroupId,
  createdUrl,
  navMode,
}: {
  groups: ManagerGroupTreeRow[];
  links: ManagerGroupRegistrationLink[];
  participants: ManagerParticipantRow[];
  canManageEvent: (eventId: string) => boolean;
  filters: GroupTableFilters;
  selectedGroup: ManagerGroupTreeRow | null;
  selectedTool: "edit" | "links" | "leaders" | null;
  createdGroupId: string | null;
  createdUrl: string | null;
  navMode: ManagerNavMode;
}) {
  const filteredGroups = filterGroupRows(groups, filters);
  const linksByGroupId = groupLinksByGroupId(links);
  const eventOptions = getGroupEventOptions(groups);

  return (
    <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gruppi</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
            Paesi, città, aree e gruppi disponibili per matching, form pubblico
            e link riservati.
          </p>
        </div>
        {eventOptions.some((event) => canManageEvent(event.id)) ? (
          <Link
            href={`${managerPath("gruppi", navMode)}&groupTool=edit`}
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
          >
            Nuovo gruppo
          </Link>
        ) : null}
      </div>

      <GroupTableFiltersForm
        filters={filters}
        eventOptions={eventOptions}
        action="/dashboard/manager"
        navMode={navMode}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <EventValue label="Gruppi visibili" value={filteredGroups.length} />
        <EventValue label="Iscrivibili" value={filteredGroups.filter((group) => group.isAssignable).length} />
        <EventValue label="Nel form pubblico" value={filteredGroups.filter((group) => group.isPublicCatalog).length} />
        <EventValue label="Link attivi" value={links.length} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
              <th className="py-3 pr-4 font-semibold">Nodo</th>
              <th className="py-3 pr-4 font-semibold">Età</th>
              <th className="py-3 pr-4 font-semibold">Referente principale</th>
              <th className="py-3 pr-4 font-semibold">Accesso iscrizione</th>
              <th className="py-3 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => {
              const canManage = canManageEvent(group.eventId);

              return (
                <tr
                  key={group.id}
                  className="border-b border-[var(--peace-border)] align-top last:border-b-0"
                >
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[var(--peace-ink)]">{group.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--peace-muted)]">
                      {group.eventTitle} - {groupNodeTypeLabel(group.nodeType)}
                      {group.parentName ? ` sotto ${group.parentName}` : ""}
                    </p>
                  </td>
                  <td className="py-4 pr-4 text-[var(--peace-ink)]">
                    {ageBracketLabel(group.ageBracket)}
                  </td>
                  <td className="py-4 pr-4 text-[var(--peace-ink)]">
                    {group.primaryLeaderName ?? "Da assegnare"}
                  </td>
                  <td className="py-4 pr-4">
                    {group.isAssignable && group.isPublicCatalog ? (
                      <span className="font-semibold text-[var(--peace-blue-800)]">Nel form pubblico</span>
                    ) : group.isAssignable ? (
                      <span className="text-[var(--peace-muted)]">Solo con link</span>
                    ) : (
                      <span className="text-[var(--peace-muted)]">Non iscrivibile</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canManage ? (
                        <Link
                          href={`${managerPath("gruppi", navMode)}&groupTool=edit&groupId=${group.id}`}
                          className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                        >
                          Modifica
                        </Link>
                      ) : null}
                      <Link
                        href={`${managerPath("gruppi", navMode)}&groupTool=links&groupId=${group.id}`}
                        className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                      >
                        Gestisci link
                      </Link>
                      {canManage ? (
                        <Link
                          href={`${managerPath("gruppi", navMode)}&groupTool=leaders&groupId=${group.id}`}
                          className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                        >
                          Capogruppo
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessun gruppo corrisponde ai filtri correnti.
        </p>
      ) : null}

      {selectedTool === "edit" ? (
        <ManagerGroupEditOverlay
          group={selectedGroup}
          groups={groups}
          eventOptions={eventOptions.filter((event) => canManageEvent(event.id))}
        />
      ) : null}

      {selectedTool === "links" && selectedGroup ? (
        <ManagerGroupLinksOverlay
          group={selectedGroup}
          links={linksByGroupId.get(selectedGroup.id) ?? []}
          canManage={canManageEvent(selectedGroup.eventId)}
          createdUrl={createdGroupId === selectedGroup.id ? createdUrl : null}
          navMode={navMode}
        />
      ) : null}

      {selectedTool === "leaders" && selectedGroup ? (
        <ManagerGroupLeaderOverlay
          group={selectedGroup}
          participants={participants.filter(
            (participant) => participant.eventId === selectedGroup.eventId
          )}
          canManage={canManageEvent(selectedGroup.eventId)}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function GroupTableFiltersForm({
  filters,
  eventOptions,
  action,
  navMode,
}: {
  filters: GroupTableFilters;
  eventOptions: Array<{ id: string; title: string }>;
  action: string;
  navMode: ManagerNavMode;
}) {
  const hasActiveFilters =
    filters.q ||
    filters.eventId !== "all" ||
    filters.nodeType !== "all" ||
    filters.visibility !== "all";

  return (
    <form
      action={action}
      className="mt-5 grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto]"
    >
      <input type="hidden" name="section" value="gruppi" />
      <input type="hidden" name="nav" value={navMode} />
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Cerca gruppo
        <input
          name="groupQ"
          defaultValue={filters.q}
          className="field bg-white font-normal"
          placeholder="Nome, referente, label"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Evento
        <select
          name="groupEvent"
          defaultValue={filters.eventId}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          {eventOptions.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Tipo
        <select
          name="groupType"
          defaultValue={filters.nodeType}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          <option value="country">Paese</option>
          <option value="city">Città</option>
          <option value="area">Area</option>
          <option value="group">Gruppo</option>
          <option value="newcomers">Nuovi partecipanti</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Visibilità
        <select
          name="groupVisibility"
          defaultValue={filters.visibility}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          <option value="public">Nel form pubblico</option>
          <option value="reserved">Solo con link</option>
          <option value="internal">Non iscrivibile</option>
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
          Filtra
        </button>
        {hasActiveFilters ? (
          <Link
            href={managerPath("gruppi", navMode)}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function ManagerGroupEditOverlay({
  group,
  groups,
  eventOptions,
}: {
  group: ManagerGroupTreeRow | null;
  groups: ManagerGroupTreeRow[];
  eventOptions: Array<{ id: string; title: string }>;
}) {
  const selectedEventId = group?.eventId ?? eventOptions[0]?.id ?? "";
  const parentOptions = groups.filter(
    (option) => option.eventId === selectedEventId && option.id !== group?.id
  );

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <h3 className="text-xl font-semibold">
            {group ? "Modifica gruppo" : "Nuovo gruppo"}
          </h3>
        </div>
        <form action={saveOperationsGroup} className="grid overflow-y-auto">
          <input type="hidden" name="sourceDashboard" value="manager" />
          {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Evento
              <select name="eventId" defaultValue={selectedEventId} className="field">
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Nome operativo
              <input name="name" defaultValue={group?.name ?? ""} className="field" required />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Parent
              <select name="parentGroupId" defaultValue={group?.parentGroupId ?? ""} className="field">
                <option value="">Radice</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Tipo
              <select name="nodeType" defaultValue={group?.nodeType ?? "group"} className="field">
                <option value="country">Paese</option>
                <option value="city">Città</option>
                <option value="area">Area</option>
                <option value="group">Gruppo</option>
                <option value="newcomers">Nuovi partecipanti</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Comunità
              <select name="communityKind" defaultValue={group?.communityKind ?? "santegidio"} className="field">
                <option value="santegidio">Sant&apos;Egidio</option>
                <option value="newcomers">Nuovi partecipanti</option>
                <option value="territorial">Territoriale</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Età
              <select name="ageBracket" defaultValue={group?.ageBracket ?? "none"} className="field">
                <option value="none">Non applicabile</option>
                <option value="giovani">Giovani</option>
                <option value="adulti">Adulti</option>
                <option value="both">Giovani e adulti</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Referente principale
              <input name="primaryLeaderName" defaultValue={group?.primaryLeaderName ?? ""} className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Label pubblica
              <input name="publicLabel" defaultValue={group?.publicLabel ?? ""} className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Ordine pubblico
              <input name="publicOrder" type="number" defaultValue={group?.publicOrder ?? 100} className="field" />
            </label>
            <div className="grid content-end gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              <label className="flex items-center gap-2">
                <input name="isActive" type="checkbox" defaultChecked={group?.isActive ?? true} />
                Attivo
              </label>
              <label className="flex items-center gap-2">
                <input name="isAssignable" type="checkbox" defaultChecked={group?.isAssignable ?? true} />
                Iscrivibile
              </label>
              <label className="flex items-center gap-2">
                <input
                  name="isPublicCatalog"
                  type="checkbox"
                  defaultChecked={group?.isPublicCatalog ?? true}
                  disabled={group ? !group.isAssignable : false}
                />
                Mostra nel form pubblico
              </label>
              {group && !group.isAssignable ? (
                <p className="text-xs font-normal leading-5 text-[var(--peace-muted)]">
                  Disponibile solo per gruppi iscrivibili.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--peace-border)] px-5 py-4">
            <Link href="/dashboard/manager?section=gruppi" className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
              Annulla
            </Link>
            <button className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Salva gruppo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManagerGroupLinksOverlay({
  group,
  links,
  canManage,
  createdUrl,
  navMode,
}: {
  group: ManagerGroupTreeRow;
  links: ManagerGroupRegistrationLink[];
  canManage: boolean;
  createdUrl: string | null;
  navMode: ManagerNavMode;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <h3 className="text-xl font-semibold">Link gruppo</h3>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
        </div>
        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          {createdUrl ? (
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Link appena generato
              <input readOnly className="field bg-white font-mono text-xs" value={createdUrl} />
            </label>
          ) : null}

          {canManage ? (
            <form action={createGroupRegistrationLink} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
              <input type="hidden" name="sourceDashboard" value="manager" />
              <input type="hidden" name="groupId" value={group.id} />
              <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                Label pubblica
                <input name="publicLabel" className="field" defaultValue={group.publicLabel ?? ""} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                Etichetta interna
                <input name="internalLabel" className="field" placeholder="Per esempio: invito assemblea giugno" />
              </label>
              <button className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                Genera link
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
              Consultazione senza permessi di modifica.
            </p>
          )}

          <div className="grid gap-2">
            {links.map((link) => (
              <div key={link.id} className="flex flex-col gap-2 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[var(--peace-ink)]">
                    {link.internalLabel ?? link.publicLabel ?? "Link senza etichetta"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--peace-muted)]">
                    {groupLinkStatusLabel(link)} - usi {link.useCount}
                    {link.maxUses ? `/${link.maxUses}` : ""}
                  </p>
                </div>
                {canManage ? (
                  <form action={revokeGroupRegistrationLink}>
                    <input type="hidden" name="sourceDashboard" value="manager" />
                    <input type="hidden" name="linkId" value={link.id} />
                    <button className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-xs font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]">
                      Revoca
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
            {links.length === 0 ? (
              <p className="text-sm text-[var(--peace-muted)]">Nessun link attivo per questo gruppo.</p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end border-t border-[var(--peace-border)] px-5 py-4">
          <Link href={managerPath("gruppi", navMode)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
            Chiudi
          </Link>
        </div>
      </div>
    </div>
  );
}

function ManagerGroupLeaderOverlay({
  group,
  participants,
  canManage,
  navMode,
}: {
  group: ManagerGroupTreeRow;
  participants: ManagerParticipantRow[];
  canManage: boolean;
  navMode: ManagerNavMode;
}) {
  const participantOptions = participants.filter((participant) => participant.email);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <h3 className="text-xl font-semibold">Capogruppo</h3>
          <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
        </div>
        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          {canManage ? (
            <>
              <form action={assignGroupLeader} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
                <input type="hidden" name="sourceDashboard" value="manager" />
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="existing" />
                <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                  Partecipante già iscritto
                  <select name="participantId" className="field bg-white font-normal" required>
                    <option value="">Seleziona una persona</option>
                    {participantOptions.map((participant) => (
                      <option key={participant.participantId} value={participant.participantId}>
                        {participant.name} - {participant.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                  Rendi capogruppo
                </button>
              </form>

              <form action={assignGroupLeader} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-white p-4">
                <input type="hidden" name="sourceDashboard" value="manager" />
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="new" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                    Nome
                    <input name="firstName" className="field" required />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                    Cognome
                    <input name="lastName" className="field" required />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
                  Email
                  <input name="email" type="email" className="field" required />
                </label>
                <button className="min-h-10 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
                  Crea scheda minima e assegna
                </button>
              </form>
            </>
          ) : (
            <p className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
              Consultazione senza permessi di modifica.
            </p>
          )}
        </div>
        <div className="flex justify-end border-t border-[var(--peace-border)] px-5 py-4">
          <Link href={managerPath("gruppi", navMode)} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
            Chiudi
          </Link>
        </div>
      </div>
    </div>
  );
}

function ManagerParticipantsSection({
  snapshot,
  selectedParticipant,
  isEditingParticipant,
  canManageEvent,
  navMode,
}: {
  snapshot: ManagerOperationsSnapshot;
  selectedParticipant: ManagerParticipantRow | null;
  isEditingParticipant: boolean;
  canManageEvent: (eventId: string) => boolean;
  navMode: ManagerNavMode;
}) {
  const eventOptions = getOperationsEventOptions(snapshot.allParticipants);

  return (
    <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Gestione iscritti</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
          Ultime iscrizioni nello scope manager, fino a 200 risultati recenti.
        </p>
      </div>

      <OperationsFiltersForm
        filters={snapshot.filters}
        eventOptions={eventOptions}
        action="/dashboard/manager"
        navMode={navMode}
      />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
              <th className="py-3 pr-4 font-semibold">Iscrizione</th>
              <th className="py-3 pr-4 font-semibold">Contatti</th>
              <th className="py-3 pr-4 font-semibold">Gruppo</th>
              <th className="py-3 text-right font-semibold">Azioni</th>
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
                      {participant.publicCode ?? "Senza codice"} -{" "}
                      {statusLabel(participant.registrationStatus)}
                    </p>
                  </td>
                  <td className="py-4 pr-4 text-[var(--peace-ink)]">
                    <p>{participant.email ?? "Email non indicata"}</p>
                    <p className="mt-1 text-xs text-[var(--peace-muted)]">
                      {participant.phone ?? "Telefono non indicato"}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-medium">
                      {participant.currentGroupName ?? "Nessun gruppo corrente"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--peace-muted)]">
                      {groupStatusLabel(participant.currentGroupStatus)}
                    </p>
                  </td>
                  <td className="py-4 text-right">
                    {canManage ? (
                      <Link
                        href={`${managerPath("iscritti", navMode)}&edit=${participant.registrationId}`}
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
      </div>

      {snapshot.participants.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessuna iscrizione corrisponde ai filtri correnti.
        </p>
      ) : null}

      {selectedParticipant ? (
        <ManagerParticipantEditOverlay
          participant={selectedParticipant}
          groupOptions={snapshot.groupOptions.filter(
            (group) => group.eventId === selectedParticipant.eventId
          )}
          isEditing={isEditingParticipant}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function OperationsFiltersForm({
  filters,
  eventOptions,
  action,
  navMode,
}: {
  filters: OperationsDashboardFilters;
  eventOptions: Array<{ id: string; title: string }>;
  action: string;
  navMode: ManagerNavMode;
}) {
  const hasActiveFilters = hasActiveOperationsDashboardFilters(filters);

  return (
    <form
      action={action}
      className="mt-5 grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto]"
    >
      <input type="hidden" name="section" value="iscritti" />
      <input type="hidden" name="nav" value={navMode} />
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Cerca
        <input
          name="q"
          defaultValue={filters.q}
          className="field bg-white font-normal"
          placeholder="Nome, codice, email, gruppo"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Evento
        <select
          name="event"
          defaultValue={filters.eventId}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          {eventOptions.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Gruppo
        <select
          name="group"
          defaultValue={filters.group}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          <option value="none">Senza gruppo</option>
          <option value="probable">Da verificare</option>
          <option value="confirmed">Confermato</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
        Stato
        <select
          name="status"
          defaultValue={filters.status}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          <option value="submitted">Inviata</option>
          <option value="confirmed">Confermata</option>
          <option value="cancelled">Annullata</option>
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
          Filtra
        </button>
        {hasActiveFilters ? (
          <Link
            href={managerPath("iscritti", navMode)}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Reset
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function ManagerParticipantEditOverlay({
  participant,
  groupOptions,
  isEditing,
  navMode,
}: {
  participant: ManagerParticipantRow;
  groupOptions: ManagerGroupOption[];
  isEditing: boolean;
  navMode: ManagerNavMode;
}) {
  const includesCurrentGroup =
    !participant.currentGroupId ||
    groupOptions.some((group) => group.id === participant.currentGroupId);
  const visibleGroupOptions: ManagerGroupOption[] =
    includesCurrentGroup ||
    !participant.currentGroupId ||
    !participant.currentGroupName
      ? groupOptions
      : [
          {
            id: participant.currentGroupId,
            eventId: participant.eventId,
            name: participant.currentGroupName,
          },
          ...groupOptions,
        ];

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Modifica iscritto</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">
              {participant.name}
              {participant.publicCode ? ` - ${participant.publicCode}` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-1 text-sm">
            <span className="font-semibold text-[var(--peace-ink)]">Contatti</span>
            <span className="text-[var(--peace-muted)]">{participant.email ?? "Email non indicata"}</span>
            <span className="text-[var(--peace-muted)]">
              {participant.phone ?? "Telefono non indicato"}
            </span>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-semibold text-[var(--peace-ink)]">Evento</span>
            <span className="text-[var(--peace-muted)]">{participant.eventTitle}</span>
          </div>
          <div className="grid gap-1 text-sm">
            <span className="font-semibold text-[var(--peace-ink)]">Gruppo corrente</span>
            <span className="text-[var(--peace-muted)]">
              {participant.currentGroupName ?? "Nessun gruppo corrente"} -{" "}
              {groupStatusLabel(participant.currentGroupStatus)}
            </span>
          </div>

          {isEditing ? (
            <form
              action="/dashboard/admin/participants/update"
              method="post"
              className="grid gap-5"
            >
              <input type="hidden" name="sourceDashboard" value="manager" />
              <input type="hidden" name="registrationId" value={participant.registrationId} />
              <input type="hidden" name="participantId" value={participant.participantId} />
              <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
                Gruppo
                <select
                  name="groupId"
                  defaultValue={participant.currentGroupId ?? ""}
                  className="min-h-11 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 font-normal text-[var(--peace-ink)]"
                >
                  {!participant.currentGroupId ? (
                    <option value="">Nessun gruppo corrente</option>
                  ) : null}
                  {visibleGroupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                Salva gruppo
              </button>
            </form>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--peace-border)] px-5 py-4">
          <Link
            href={managerPath("iscritti", navMode)}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Chiudi
          </Link>
          {!isEditing ? (
            <Link
              href={`${managerPath("iscritti", navMode)}&edit=${participant.registrationId}&editMode=1`}
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
            >
              Modifica gruppo
            </Link>
          ) : null}
        </div>
      </div>
    </div>
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
      ? "min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
      : "min-h-11 rounded-md border border-[var(--peace-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]";

  return (
    <form action={updateEventOpeningState}>
      <input type="hidden" name="sourceDashboard" value="manager" />
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
  managerError,
  managerSaved,
  groupLinkError,
  groupLinkSaved,
  groupError,
  groupSaved,
}: {
  error?: string;
  saved?: string;
  managerError?: string;
  managerSaved?: string;
  groupLinkError?: string;
  groupLinkSaved?: string;
  groupError?: string;
  groupSaved?: string;
}) {
  if (saved || managerSaved || groupLinkSaved || groupSaved) {
    return (
      <p className="rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        {groupSaved
          ? "Gruppo aggiornato."
          : groupLinkSaved
          ? "Link gruppo aggiornato."
          : managerSaved
            ? "Gestione iscritti aggiornata."
            : "Configurazione apertura aggiornata."}
      </p>
    );
  }

  if (!error && !managerError && !groupLinkError && !groupError) {
    return null;
  }

  const messages: Record<string, string> = {
    invalid: "Comando apertura non valido.",
    "not-found": "Evento non trovato.",
    forbidden: "Non hai permessi di modifica su questo evento.",
    "invalid-group": "Gruppo non valido per questa iscrizione.",
    "invalid-parent": "Il gruppo parent non è valido per questo evento.",
  };
  const messageKey = groupError ?? groupLinkError ?? managerError ?? error;

  return (
    <p className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {messageKey
        ? messages[messageKey] ?? "Non è stato possibile completare l'operazione."
        : "Non è stato possibile completare l'operazione."}
    </p>
  );
}

function WatchItem({ label, value }: { label: string; value: number }) {
  const hasIssue = value > 0;

  return (
    <div
      className={
        hasIssue
          ? "border-l-4 border-[#b85f47] bg-[#fff8f5] px-4 py-3"
          : "border-l-4 border-[var(--peace-border-strong)] bg-[#f7fbfe] px-4 py-3"
      }
    >
      <p className="text-sm text-[var(--peace-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EventValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-[var(--peace-border)] pt-3">
      <p className="text-sm text-[var(--peace-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--peace-muted)]">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--peace-ink)]">{value}</dd>
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

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatParticipantName(
  firstName: string | null,
  lastName: string | null
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  return name || "Partecipante senza nome";
}

function formatPlace(city: string | null, country: string | null): string {
  const parts = [city, country].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Provenienza non indicata";
}

function getOperationsEventOptions(
  participants: ManagerParticipantRow[]
): Array<{ id: string; title: string }> {
  const eventsById = new Map<string, string>();

  for (const participant of participants) {
    eventsById.set(participant.eventId, participant.eventTitle);
  }

  return [...eventsById].map(([id, title]) => ({ id, title }));
}

function parseGroupTableFilters(input: {
  groupQ?: string;
  groupEvent?: string;
  groupType?: string;
  groupVisibility?: string;
}): GroupTableFilters {
  return {
    q: (input.groupQ ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    eventId: input.groupEvent?.trim() || "all",
    nodeType: isGroupNodeTypeFilter(input.groupType) ? input.groupType ?? "all" : "all",
    visibility: isGroupVisibilityFilter(input.groupVisibility)
      ? input.groupVisibility ?? "all"
      : "all",
  };
}

function filterGroupRows(
  groups: ManagerGroupTreeRow[],
  filters: GroupTableFilters
): ManagerGroupTreeRow[] {
  return groups.filter((group) => {
    if (filters.eventId !== "all" && group.eventId !== filters.eventId) {
      return false;
    }

    if (filters.nodeType !== "all" && group.nodeType !== filters.nodeType) {
      return false;
    }

    if (!matchesGroupVisibility(group, filters.visibility)) {
      return false;
    }

    if (!filters.q) {
      return true;
    }

    const haystack = [
      group.name,
      group.parentName,
      group.primaryLeaderName,
      group.publicLabel,
      group.eventTitle,
      groupNodeTypeLabel(group.nodeType),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(filters.q.toLowerCase());
  });
}

function matchesGroupVisibility(
  group: ManagerGroupTreeRow,
  visibility: string
): boolean {
  switch (visibility) {
    case "public":
      return Boolean(group.isAssignable && group.isPublicCatalog);
    case "reserved":
      return Boolean(group.isAssignable && !group.isPublicCatalog);
    case "internal":
      return !group.isAssignable;
    default:
      return true;
  }
}

function groupLinksByGroupId(
  links: ManagerGroupRegistrationLink[]
): Map<string, ManagerGroupRegistrationLink[]> {
  const linksByGroupId = new Map<string, ManagerGroupRegistrationLink[]>();

  for (const link of links) {
    const groupLinks = linksByGroupId.get(link.groupId) ?? [];
    groupLinks.push(link);
    linksByGroupId.set(link.groupId, groupLinks);
  }

  return linksByGroupId;
}

function getGroupEventOptions(
  groups: ManagerGroupTreeRow[]
): Array<{ id: string; title: string }> {
  const eventsById = new Map<string, string>();

  for (const group of groups) {
    eventsById.set(group.eventId, group.eventTitle);
  }

  return [...eventsById].map(([id, title]) => ({ id, title }));
}

function isGroupNodeTypeFilter(value: string | undefined): boolean {
  return (
    value === "all" ||
    value === "country" ||
    value === "city" ||
    value === "area" ||
    value === "group" ||
    value === "newcomers"
  );
}

function isGroupVisibilityFilter(value: string | undefined): boolean {
  return (
    value === "all" ||
    value === "public" ||
    value === "reserved" ||
    value === "internal"
  );
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "submitted":
      return "iscrizione inviata";
    case "confirmed":
      return "iscrizione confermata";
    case "cancelled":
      return "iscrizione annullata";
    default:
      return status ?? "stato non indicato";
  }
}

function groupStatusLabel(status: string | null): string {
  switch (status) {
    case "confirmed":
      return "gruppo confermato";
    case "probable":
      return "da verificare";
    case "rejected":
      return "rifiutato";
    default:
      return "stato gruppo non indicato";
  }
}

function groupLinkStatusLabel(link: ManagerGroupRegistrationLink): string {
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

function groupNodeTypeLabel(value: string | null): string {
  switch (value) {
    case "country":
      return "Paese";
    case "city":
      return "Città";
    case "area":
      return "Area";
    case "newcomers":
      return "Nuovi partecipanti";
    case "group":
      return "Gruppo";
    default:
      return "Nodo";
  }
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function ageBracketLabel(value: string | null): string {
  switch (value) {
    case "giovani":
      return "Giovani";
    case "adulti":
      return "Adulti";
    case "both":
      return "Giovani e adulti";
    case "none":
      return "Non applicabile";
    default:
      return "Non indicata";
  }
}
