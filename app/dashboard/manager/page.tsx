import Link from "next/link";
import { redirect } from "next/navigation";

import {
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
    event?: string;
    group?: string;
    q?: string;
    role?: string;
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

type ManagerRoleRow = {
  event_id: string | null;
  user_id: string;
  role: string | null;
};

type ManagerGroupMembershipRoleRow = {
  user_id: string;
  role: string | null;
  groups:
    | { event_id: string | null }
    | Array<{ event_id: string | null }>
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
  roles: string[];
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

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard manager</h1>
          <DashboardRoleTabs activeRole="manager" eventRoles={auth.eventRoles} />
          <DashboardAreaDescription>
            In questa area puoi seguire apertura, iscrizioni, gruppi e ruoli
            operativi degli eventi assegnati.
          </DashboardAreaDescription>
        </header>

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

        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-semibold">Apertura e monitoraggio</h2>
            <p className="mt-1 text-sm leading-6 text-[#5e6d63]">
              I manager possono aprire o sospendere le iscrizioni degli eventi
              assegnati. I manager viewer consultano soltanto i dati.
            </p>
          </div>

          {snapshots.map((snapshot) => (
            <EventOpeningCard key={snapshot.event.id} snapshot={snapshot} />
          ))}

          {snapshots.length === 0 ? (
            <div className="rounded-lg border border-[#d8dece] bg-white p-5 text-sm text-[#5e6d63]">
              Nessun evento manager assegnato a questo utente.
            </div>
          ) : null}
        </section>

        <ManagerParticipantsSection
          snapshot={managerOperations}
          selectedParticipant={selectedCanManage ? selectedParticipant : null}
          canManageEvent={scope.canManageEvent}
        />

        <ManagerGroupTreeSection
          groups={managerOperations.groupTree}
          links={managerOperations.groupLinks}
          canManageEvent={scope.canManageEvent}
          filters={parseGroupTableFilters(params)}
          selectedGroup={selectedGroup}
          selectedTool={params.groupTool === "links" ? "links" : params.groupTool === "edit" ? "edit" : null}
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
      </section>
    </main>
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
  const eventIds = [...new Set(registrationRows.map((row) => row.event_id))];
  const authUserIds = [
    ...new Set(
      registrationRows
        .map((row) => relatedOne(row.participants)?.auth_user_id)
        .filter((userId): userId is string => Boolean(userId))
    ),
  ];
  const emptyResult = { data: [] };
  const [
    { data: contacts },
    { data: assignments },
    { data: roles },
    { data: groupMembershipRoles },
  ] = await Promise.all([
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
    authUserIds.length > 0
      ? supabase.from("event_user_roles").select("event_id,user_id,role").in("user_id", authUserIds)
      : Promise.resolve(emptyResult),
    authUserIds.length > 0
      ? supabase.from("group_memberships").select("user_id,role,groups(event_id)").in("user_id", authUserIds)
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
  const rolesByUserEvent = new Map<string, string[]>();

  for (const role of (roles ?? []) as ManagerRoleRow[]) {
    if (!role.role) {
      continue;
    }

    if (role.event_id) {
      const key = `${role.user_id}:${role.event_id}`;
      const values = rolesByUserEvent.get(key) ?? [];
      values.push(role.role);
      rolesByUserEvent.set(key, values);
    } else if (role.role === "admin") {
      for (const eventId of eventIds) {
        const key = `${role.user_id}:${eventId}`;
        const values = rolesByUserEvent.get(key) ?? [];
        values.push(role.role);
        rolesByUserEvent.set(key, values);
      }
    }
  }

  for (const membership of
    (groupMembershipRoles ?? []) as ManagerGroupMembershipRoleRow[]) {
    if (membership.role !== "capogruppo") {
      continue;
    }

    const eventId = relatedOne(membership.groups)?.event_id;

    if (!eventId) {
      continue;
    }

    const key = `${membership.user_id}:${eventId}`;
    const values = rolesByUserEvent.get(key) ?? [];

    if (!values.includes("capogruppo")) {
      values.push("capogruppo");
    }

    rolesByUserEvent.set(key, values);
  }

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
        roles: authUserId
          ? rolesByUserEvent.get(`${authUserId}:${registration.event_id}`) ?? []
          : [],
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
          <p className="rounded-md border border-[#d8dece] bg-[#f8faf5] px-4 py-3 text-sm text-[#5e6d63]">
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

      <p className="mt-4 text-sm text-[#5e6d63]">
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
  canManageEvent,
  filters,
  selectedGroup,
  selectedTool,
  createdGroupId,
  createdUrl,
}: {
  groups: ManagerGroupTreeRow[];
  links: ManagerGroupRegistrationLink[];
  canManageEvent: (eventId: string) => boolean;
  filters: GroupTableFilters;
  selectedGroup: ManagerGroupTreeRow | null;
  selectedTool: "edit" | "links" | null;
  createdGroupId: string | null;
  createdUrl: string | null;
}) {
  const filteredGroups = filterGroupRows(groups, filters);
  const linksByGroupId = groupLinksByGroupId(links);
  const eventOptions = getGroupEventOptions(groups);

  return (
    <section className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gruppi</h2>
          <p className="mt-2 text-sm leading-6 text-[#5e6d63]">
            Paesi, città, aree e gruppi disponibili per matching, form pubblico
            e link riservati.
          </p>
        </div>
        {eventOptions.some((event) => canManageEvent(event.id)) ? (
          <Link
            href="/dashboard/manager?groupTool=edit"
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-[#315c44] px-4 text-sm font-semibold text-white transition hover:bg-[#264a36]"
          >
            Nuovo gruppo
          </Link>
        ) : null}
      </div>

      <GroupTableFiltersForm
        filters={filters}
        eventOptions={eventOptions}
        action="/dashboard/manager"
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
            <tr className="border-b border-[#dfe5d8] text-xs uppercase tracking-wide text-[#66745f]">
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
                  className="border-b border-[#edf1e8] align-top last:border-b-0"
                >
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[#1c241f]">{group.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[#5e6d63]">
                      {group.eventTitle} - {groupNodeTypeLabel(group.nodeType)}
                      {group.parentName ? ` sotto ${group.parentName}` : ""}
                    </p>
                  </td>
                  <td className="py-4 pr-4 text-[#39483f]">
                    {ageBracketLabel(group.ageBracket)}
                  </td>
                  <td className="py-4 pr-4 text-[#39483f]">
                    {group.primaryLeaderName ?? "Da assegnare"}
                  </td>
                  <td className="py-4 pr-4">
                    {group.isAssignable && group.isPublicCatalog ? (
                      <span className="font-semibold text-[#2f5e46]">Nel form pubblico</span>
                    ) : group.isAssignable ? (
                      <span className="text-[#5e6d63]">Solo con link</span>
                    ) : (
                      <span className="text-[#5e6d63]">Non iscrivibile</span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canManage ? (
                        <Link
                          href={`/dashboard/manager?groupTool=edit&groupId=${group.id}`}
                          className="inline-flex min-h-9 items-center rounded-md border border-[#b8c5ad] px-3 text-xs font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
                        >
                          Modifica
                        </Link>
                      ) : null}
                      <Link
                        href={`/dashboard/manager?groupTool=links&groupId=${group.id}`}
                        className="inline-flex min-h-9 items-center rounded-md border border-[#b8c5ad] px-3 text-xs font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
                      >
                        Gestisci link
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[#5e6d63]">
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
        />
      ) : null}
    </section>
  );
}

function GroupTableFiltersForm({
  filters,
  eventOptions,
  action,
}: {
  filters: GroupTableFilters;
  eventOptions: Array<{ id: string; title: string }>;
  action: string;
}) {
  const hasActiveFilters =
    filters.q ||
    filters.eventId !== "all" ||
    filters.nodeType !== "all" ||
    filters.visibility !== "all";

  return (
    <form
      action={action}
      className="mt-5 grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto]"
    >
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Cerca gruppo
        <input
          name="groupQ"
          defaultValue={filters.q}
          className="field bg-white font-normal"
          placeholder="Nome, referente, label"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
        <button className="min-h-11 rounded-md bg-[#315c44] px-4 text-sm font-semibold text-white transition hover:bg-[#264a36]">
          Filtra
        </button>
        {hasActiveFilters ? (
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#38563d] transition hover:bg-[#eef2e7]"
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
        <div className="border-b border-[#dfe5d8] px-5 py-4">
          <h3 className="text-xl font-semibold">
            {group ? "Modifica gruppo" : "Nuovo gruppo"}
          </h3>
        </div>
        <form action={saveOperationsGroup} className="grid overflow-y-auto">
          <input type="hidden" name="sourceDashboard" value="manager" />
          {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Evento
              <select name="eventId" defaultValue={selectedEventId} className="field">
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Nome operativo
              <input name="name" defaultValue={group?.name ?? ""} className="field" required />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
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
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Tipo
              <select name="nodeType" defaultValue={group?.nodeType ?? "group"} className="field">
                <option value="country">Paese</option>
                <option value="city">Città</option>
                <option value="area">Area</option>
                <option value="group">Gruppo</option>
                <option value="newcomers">Nuovi partecipanti</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Comunità
              <select name="communityKind" defaultValue={group?.communityKind ?? "santegidio"} className="field">
                <option value="santegidio">Sant&apos;Egidio</option>
                <option value="newcomers">Nuovi partecipanti</option>
                <option value="territorial">Territoriale</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Età
              <select name="ageBracket" defaultValue={group?.ageBracket ?? "none"} className="field">
                <option value="none">Non applicabile</option>
                <option value="giovani">Giovani</option>
                <option value="adulti">Adulti</option>
                <option value="both">Giovani e adulti</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Referente principale
              <input name="primaryLeaderName" defaultValue={group?.primaryLeaderName ?? ""} className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Label pubblica
              <input name="publicLabel" defaultValue={group?.publicLabel ?? ""} className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Ordine pubblico
              <input name="publicOrder" type="number" defaultValue={group?.publicOrder ?? 100} className="field" />
            </label>
            <div className="grid content-end gap-2 text-sm font-semibold text-[#38453c]">
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
                <p className="text-xs font-normal leading-5 text-[#6b7a70]">
                  Disponibile solo per gruppi iscrivibili.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#dfe5d8] px-5 py-4">
            <Link href="/dashboard/manager" className="inline-flex min-h-11 items-center rounded-md border border-[#c8d5be] px-4 text-sm font-semibold text-[#38563d] transition hover:bg-[#eef2e7]">
              Annulla
            </Link>
            <button className="min-h-11 rounded-md bg-[#2f5e46] px-4 text-sm font-semibold text-white transition hover:bg-[#254b38]">
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
}: {
  group: ManagerGroupTreeRow;
  links: ManagerGroupRegistrationLink[];
  canManage: boolean;
  createdUrl: string | null;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[#dfe5d8] px-5 py-4">
          <h3 className="text-xl font-semibold">Link gruppo</h3>
          <p className="mt-1 text-sm text-[#5e6d63]">{group.name}</p>
        </div>
        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          {createdUrl ? (
            <label className="grid gap-2 text-sm font-semibold text-[#3c4b40]">
              Link appena generato
              <input readOnly className="field bg-white font-mono text-xs" value={createdUrl} />
            </label>
          ) : null}

          {canManage ? (
            <form action={createGroupRegistrationLink} className="grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4">
              <input type="hidden" name="sourceDashboard" value="manager" />
              <input type="hidden" name="groupId" value={group.id} />
              <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
                Label pubblica
                <input name="publicLabel" className="field" defaultValue={group.publicLabel ?? ""} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
                Etichetta interna
                <input name="internalLabel" className="field" placeholder="Per esempio: invito assemblea giugno" />
              </label>
              <button className="min-h-10 rounded-md bg-[#315c44] px-3 text-sm font-semibold text-white transition hover:bg-[#264a36]">
                Genera link
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-[#d8dece] bg-[#f8faf5] p-3 text-sm text-[#5e6d63]">
              Consultazione senza permessi di modifica.
            </p>
          )}

          <div className="grid gap-2">
            {links.map((link) => (
              <div key={link.id} className="flex flex-col gap-2 rounded-md border border-[#e1e6da] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-[#1c241f]">
                    {link.internalLabel ?? link.publicLabel ?? "Link senza etichetta"}
                  </p>
                  <p className="mt-1 text-xs text-[#5e6d63]">
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
              <p className="text-sm text-[#5e6d63]">Nessun link attivo per questo gruppo.</p>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end border-t border-[#dfe5d8] px-5 py-4">
          <Link href="/dashboard/manager" className="inline-flex min-h-11 items-center rounded-md border border-[#c8d5be] px-4 text-sm font-semibold text-[#38563d] transition hover:bg-[#eef2e7]">
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
  canManageEvent,
}: {
  snapshot: ManagerOperationsSnapshot;
  selectedParticipant: ManagerParticipantRow | null;
  canManageEvent: (eventId: string) => boolean;
}) {
  const eventOptions = getOperationsEventOptions(snapshot.allParticipants);

  return (
    <section className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Gestione iscritti</h2>
        <p className="mt-2 text-sm leading-6 text-[#5e6d63]">
          Ultime iscrizioni nello scope manager, fino a 200 risultati recenti.
        </p>
      </div>

      <OperationsFiltersForm
        filters={snapshot.filters}
        eventOptions={eventOptions}
        action="/dashboard/manager"
      />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#dfe5d8] text-xs uppercase tracking-wide text-[#66745f]">
              <th className="py-3 pr-4 font-semibold">Iscrizione</th>
              <th className="py-3 pr-4 font-semibold">Contatti</th>
              <th className="py-3 pr-4 font-semibold">Gruppo</th>
              <th className="py-3 pr-4 font-semibold">Ruoli</th>
              <th className="py-3 text-right font-semibold">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.participants.map((participant) => {
              const canManage = canManageEvent(participant.eventId);

              return (
                <tr
                  key={participant.registrationId}
                  className="border-b border-[#edf1e8] align-top last:border-b-0"
                >
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[#1c241f]">{participant.name}</p>
                    <p className="mt-1 text-xs text-[#5e6d63]">
                      {participant.publicCode ?? "Senza codice"} -{" "}
                      {statusLabel(participant.registrationStatus)}
                    </p>
                  </td>
                  <td className="py-4 pr-4 text-[#39483f]">
                    <p>{participant.email ?? "Email non indicata"}</p>
                    <p className="mt-1 text-xs text-[#5e6d63]">
                      {participant.phone ?? "Telefono non indicato"}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="font-medium">
                      {participant.currentGroupName ?? "Nessun gruppo corrente"}
                    </p>
                    <p className="mt-1 text-xs text-[#5e6d63]">
                      {groupStatusLabel(participant.currentGroupStatus)}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    {participant.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {participant.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full border border-[#c8d5be] bg-[#f8faf5] px-2 py-1 text-xs font-semibold text-[#38563d]"
                          >
                            {roleLabel(role)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#5e6d63]">Nessun ruolo operativo</p>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    {canManage ? (
                      <Link
                        href={`/dashboard/manager?edit=${participant.registrationId}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
                      >
                        Modifica
                      </Link>
                    ) : (
                      <span className="text-sm text-[#5e6d63]">Solo lettura</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {snapshot.participants.length === 0 ? (
        <p className="mt-4 text-sm text-[#5e6d63]">
          Nessuna iscrizione corrisponde ai filtri correnti.
        </p>
      ) : null}

      {selectedParticipant ? (
        <ManagerParticipantEditOverlay
          participant={selectedParticipant}
          groupOptions={snapshot.groupOptions.filter(
            (group) => group.eventId === selectedParticipant.eventId
          )}
        />
      ) : null}
    </section>
  );
}

function OperationsFiltersForm({
  filters,
  eventOptions,
  action,
}: {
  filters: OperationsDashboardFilters;
  eventOptions: Array<{ id: string; title: string }>;
  action: string;
}) {
  const hasActiveFilters = hasActiveOperationsDashboardFilters(filters);

  return (
    <form
      action={action}
      className="mt-5 grid gap-3 rounded-md border border-[#e1e6da] bg-[#fbfcf8] p-4 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))_auto]"
    >
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Cerca
        <input
          name="q"
          defaultValue={filters.q}
          className="field bg-white font-normal"
          placeholder="Nome, codice, email, gruppo"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
        Ruolo
        <select
          name="role"
          defaultValue={filters.role}
          className="field bg-white font-normal"
        >
          <option value="all">Tutti</option>
          <option value="operational">Con ruolo</option>
          <option value="none">Senza ruolo</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
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
        <button className="min-h-11 rounded-md bg-[#315c44] px-4 text-sm font-semibold text-white transition hover:bg-[#264a36]">
          Filtra
        </button>
        {hasActiveFilters ? (
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#38563d] transition hover:bg-[#eef2e7]"
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
}: {
  participant: ManagerParticipantRow;
  groupOptions: ManagerGroupOption[];
}) {
  const currentOperationalRole = getCurrentManagerAssignableRole(participant.roles);
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
        <div className="border-b border-[#dfe5d8] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Modifica iscritto</h3>
            <p className="mt-1 text-sm text-[#5e6d63]">
              {participant.name}
              {participant.publicCode ? ` - ${participant.publicCode}` : ""}
            </p>
          </div>
        </div>

        <form
          action="/dashboard/admin/participants/update"
          method="post"
          className="grid overflow-y-auto"
        >
          <input type="hidden" name="sourceDashboard" value="manager" />
          <input type="hidden" name="registrationId" value={participant.registrationId} />
          <input type="hidden" name="participantId" value={participant.participantId} />
          <input type="hidden" name="email" value={participant.email ?? ""} />
          <input type="hidden" name="fullName" value={participant.name} />

          <div className="grid gap-5 px-5 py-5">
            <div className="grid gap-1 text-sm">
              <span className="font-semibold text-[#1c241f]">Contatti</span>
              <span className="text-[#5e6d63]">{participant.email ?? "Email non indicata"}</span>
              <span className="text-[#5e6d63]">
                {participant.phone ?? "Telefono non indicato"}
              </span>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Gruppo
              <select
                name="groupId"
                defaultValue={participant.currentGroupId ?? ""}
                className="min-h-11 rounded-md border border-[#c8d5be] bg-white px-3 font-normal text-[#1c241f]"
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

            <label className="grid gap-2 text-sm font-semibold text-[#38453c]">
              Ruolo operativo
              <select
                name="role"
                defaultValue={currentOperationalRole || ""}
                className="min-h-11 rounded-md border border-[#c8d5be] bg-white px-3 font-normal text-[#1c241f]"
              >
                <option value="">Nessun ruolo operativo</option>
                <option value="manager_viewer">Manager viewer</option>
                <option value="accoglienza">Accoglienza</option>
                <option value="capogruppo">Capogruppo</option>
              </select>
            </label>

            {hasProtectedOperationalRole(participant.roles) ? (
              <p className="rounded-md border border-[#d8dece] bg-[#f8faf5] px-3 py-2 text-sm text-[#5e6d63]">
                Admin e manager esistenti restano invariati da questa schermata.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#dfe5d8] px-5 py-4">
            <Link
              href="/dashboard/manager"
              className="inline-flex min-h-11 items-center rounded-md border border-[#c8d5be] px-4 text-sm font-semibold text-[#38563d] transition hover:bg-[#eef2e7]"
            >
              Annulla
            </Link>
            <button className="min-h-11 rounded-md bg-[#2f5e46] px-4 text-sm font-semibold text-white transition hover:bg-[#254b38]">
              Conferma modifiche
            </button>
          </div>
        </form>
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
      ? "min-h-11 rounded-md bg-[#2f5e46] px-4 text-sm font-semibold text-white transition hover:bg-[#254b38]"
      : "min-h-11 rounded-md border border-[#c8d5be] bg-white px-4 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]";

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
    "invalid-role": "Ruolo non valido per questa iscrizione.",
    "protected-role": "Solo l'admin può assegnare admin o manager.",
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

function roleLabel(role: string): string {
  switch (role) {
    case "manager":
      return "Manager";
    case "manager_viewer":
      return "Manager viewer";
    case "accoglienza":
      return "Accoglienza";
    case "admin":
      return "Admin";
    case "capogruppo":
      return "Capogruppo";
    default:
      return role;
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

function getCurrentManagerAssignableRole(
  roles: string[]
): "manager_viewer" | "accoglienza" | "capogruppo" | null {
  const role = roles.find(isManagerAssignableRole);

  return role ?? null;
}

function isManagerAssignableRole(
  role: string
): role is "manager_viewer" | "accoglienza" | "capogruppo" {
  return (
    role === "manager_viewer" ||
    role === "accoglienza" ||
    role === "capogruppo"
  );
}

function hasProtectedOperationalRole(roles: string[]): boolean {
  return roles.some((role) => role === "admin" || role === "manager");
}
