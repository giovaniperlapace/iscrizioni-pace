import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Network,
  Pencil,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import {
  assignOperationalUserRole,
  assignGroupLeader,
  createFutureEvent,
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  saveOperationsGroup,
  setCurrentOperationalEvent,
  updateEventOpeningState,
  updateOperationalUserRole,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { AutoFilterForm } from "@/app/dashboard/auto-filter-form";
import {
  type GroupEditLeaderRow,
  GroupPlacementFields,
  GroupPrimaryLeaderFields,
} from "@/app/dashboard/group-edit-fields";
import { AutoCopyLinkNotice, CopyLinkButton } from "@/app/dashboard/group-link-copy-tools";
import { GroupLeaderKindField } from "@/app/dashboard/group-leader-kind-field";
import { GroupLeaderModeTabs } from "@/app/dashboard/group-leader-mode-tabs";
import { OperationalRoleFields } from "@/app/dashboard/operational-role-fields";
import { ParticipantSearchField } from "@/app/dashboard/participant-search-field";
import { PreserveDashboardScroll } from "@/app/dashboard/preserve-dashboard-scroll";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import {
  getOpeningState,
  openingStateLabel,
  summarizeRegistrationMonitoring,
  type RegistrationMonitoringInput,
  type RegistrationMonitoringSummary,
} from "@/lib/registrations/opening-monitoring";
import {
  buildGroupRegistrationUrl,
  getGroupRegistrationLinkStatus,
} from "@/lib/groups/registration-links";
import {
  applyOperationsDashboardFilters,
  hasActiveOperationsDashboardFilters,
  parseOperationsDashboardFilters,
  summarizeOperationsDashboardParticipants,
  type OperationsDashboardFilters,
  type OperationsDashboardSummary,
} from "@/lib/registrations/operations-dashboard";
import {
  buildEventStatisticsSnapshot,
  type EventStatisticsSnapshot,
  type ParticipantBreakdownLevel,
} from "@/lib/registrations/event-statistics";
import {
  getOperationalUserIdentities,
  splitFullName,
} from "@/lib/operational-users/identity";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type AdminPageProps = {
  searchParams: Promise<{
    openingError?: string;
    openingSaved?: string;
    adminError?: string;
    adminSaved?: string;
    editMode?: string;
    eventTool?: string;
    edit?: string;
    event?: string;
    groupError?: string;
    groupEvent?: string;
    groupId?: string;
    groupLinkError?: string;
    groupLinkGroupId?: string;
    groupLinkSaved?: string;
    groupLinkToken?: string;
    groupQ?: string;
    groupSaved?: string;
    groupTool?: string;
    groupType?: string;
    groupVisibility?: string;
    roleError?: string;
    roleSaved?: string;
    roleUserId?: string;
    roleRole?: string;
    roleEventId?: string;
    roleGroupId?: string;
    group?: string;
    contact?: string;
    q?: string;
    nav?: string;
    section?: string;
    stat?: string;
    status?: string;
  }>;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_current: boolean | null;
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
  phone: string | null;
};

type AdminRegistrationRow = {
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

type AdminCurrentAssignmentRow = {
  registration_id: string;
  group_id: string;
  status: string | null;
  groups:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
};

type AdminGroupOption = {
  id: string;
  eventId: string;
  name: string;
};

type AdminGroupTreeRow = {
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

type AdminGroupRegistrationLinkRow = {
  id: string;
  event_id: string;
  group_id: string;
  public_label: string | null;
  internal_label: string | null;
  token_encrypted: string | null;
  use_count: number | null;
  max_uses: number | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

type AdminGroupRegistrationLink = {
  id: string;
  eventId: string;
  groupId: string;
  publicLabel: string | null;
  internalLabel: string | null;
  url: string | null;
  useCount: number;
  maxUses: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

type GroupTableFilters = {
  q: string;
  eventId: string;
  nodeType: string;
  visibility: string;
};

type AdminParticipantRow = {
  registrationId: string;
  eventId: string;
  eventTitle: string;
  participantId: string;
  authUserId: string | null;
  name: string;
  publicCode: string | null;
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
};

type AdminOperationsSnapshot = {
  participants: AdminParticipantRow[];
  allParticipants: AdminParticipantRow[];
  groupOptions: AdminGroupOption[];
  groupTree: AdminGroupTreeRow[];
  groupLinks: AdminGroupRegistrationLink[];
  roleUsers: OperationalUserRoleRow[];
  filters: OperationsDashboardFilters;
  summary: OperationsDashboardSummary;
};

type EventSnapshot = {
  event: EventRow;
  openingState: ReturnType<typeof getOpeningState>;
  summary: RegistrationMonitoringSummary;
  emailErrorsLast24Hours: number;
};

type OperationalUserRoleRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  assignments: OperationalUserRoleAssignment[];
  eventRoles: OperationalUserRoleAssignment[];
  groupLeaderAssignments: OperationalUserRoleAssignment[];
};

type OperationalUserRoleAssignment = {
  role: string;
  isPrimaryGroupLeader: boolean | null;
  eventId: string | null;
  eventTitle: string | null;
  groupId: string | null;
  groupName: string | null;
};

type AttendanceChoiceRow = {
  registration_id: string;
  day: string | null;
  choice: string | null;
};

type AdminSection = "evento" | "dashboard" | "iscritti" | "ruoli" | "gruppi";
type AdminNavMode = "full" | "mini";

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
  const filters = parseOperationsDashboardFilters(params);
  const currentEvent = await getCurrentOperationalEvent(serviceSupabase, "id,title");
  const currentEventId = currentEvent?.id ?? null;
  const [snapshots, adminOperations] = await Promise.all([
    getOpeningSnapshots(),
    getAdminOperationsSnapshot(filters, currentEventId),
  ]);
  const statistics = await getAdminStatisticsSnapshot(
    adminOperations.groupTree,
    currentEventId
  );
  const selectedAdminParticipant =
    adminOperations.allParticipants.find(
      (participant) => participant.registrationId === params.edit
    ) ?? null;
  const selectedGroup =
    adminOperations.groupTree.find((group) => group.id === params.groupId) ??
    null;
  const selectedOperationalRole =
    adminOperations.roleUsers.find((role) => role.userId === params.roleUserId) ??
    null;
  const activeSection = resolveAdminSection(params);
  const navMode: AdminNavMode = params.nav === "mini" ? "mini" : "full";

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <PreserveDashboardScroll />
      <section className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard admin</h1>
          <DashboardRoleTabs activeRole="admin" eventRoles={auth.eventRoles} />
          <DashboardAreaDescription>
            In questa area puoi aprire o sospendere le iscrizioni, controllare
            i numeri principali e gestire gruppi e ruoli operativi.
          </DashboardAreaDescription>
        </header>

        <div
          className={[
            "grid gap-4 lg:items-start",
            navMode === "mini" ? "lg:grid-cols-[4.75rem_1fr]" : "lg:grid-cols-[11.5rem_1fr]",
          ].join(" ")}
        >
          <AdminSidebar activeSection={activeSection} navMode={navMode} />

          <div className="grid min-w-0 gap-6">
            <StatusMessage
              error={params.openingError}
              saved={params.openingSaved}
              adminError={params.adminError}
              adminSaved={params.adminSaved}
              groupError={params.groupError}
              groupSaved={params.groupSaved}
              groupLinkError={params.groupLinkError}
              groupLinkSaved={params.groupLinkSaved}
              roleError={params.roleError}
              roleSaved={params.roleSaved}
            />

            {activeSection === "evento" ? (
              <AdminEventSection
                snapshots={snapshots}
                isCreatingEvent={params.eventTool === "new"}
                navMode={navMode}
              />
            ) : null}

            {activeSection === "dashboard" ? (
              <StatisticsSection
                statistics={statistics}
                basePath="/dashboard/admin"
                navMode={navMode}
                activeLevel={resolveParticipantBreakdownLevel(params.stat)}
              />
            ) : null}

            {activeSection === "iscritti" ? (
              <AdminParticipantsSection
                snapshot={adminOperations}
                selectedParticipant={selectedAdminParticipant}
                isEditingParticipant={params.editMode === "1"}
                navMode={navMode}
              />
            ) : null}

            {activeSection === "ruoli" ? (
              <AdminOperationalUsersSection
                roles={adminOperations.roleUsers}
                eventOptions={
                  currentEvent ? [{ id: currentEvent.id, title: currentEvent.title }] : []
                }
                groupOptions={adminOperations.groupTree.filter(
                  (group) => group.isActive && group.isAssignable
                )}
                selectedRole={selectedOperationalRole}
                navMode={navMode}
              />
            ) : null}

            {activeSection === "gruppi" ? (
              <AdminGroupTreeSection
                groups={adminOperations.groupTree}
                links={adminOperations.groupLinks}
                participants={adminOperations.allParticipants}
                roleUsers={adminOperations.roleUsers}
                currentEventOption={
                  currentEvent ? { id: currentEvent.id, title: currentEvent.title } : null
                }
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

  async function getAdminOperationsSnapshot(
    filters: OperationsDashboardFilters,
    currentEventId: string | null
  ): Promise<AdminOperationsSnapshot> {
    if (!currentEventId) {
      return {
        participants: [],
        allParticipants: [],
        groupOptions: [],
        groupTree: [],
        groupLinks: [],
        roleUsers: [],
        filters,
        summary: summarizeOperationsDashboardParticipants([], []),
      };
    }

    const [
      { data: registrations },
      { data: groups },
      { data: groupTree },
      { data: groupLinks },
      { data: eventRoles },
      { data: groupMemberships },
    ] = await Promise.all([
      serviceSupabase
        .from("registrations")
        .select(
          "id,event_id,participant_id,status,submitted_at,events(title),participants(id,auth_user_id,first_name,last_name,public_code,country_other,city_other)"
        )
        .eq("event_id", currentEventId)
        .order("submitted_at", { ascending: false })
        .limit(200),
      serviceSupabase
        .from("groups")
        .select("id,event_id,name,is_assignable,is_active")
        .eq("event_id", currentEventId)
        .eq("is_active", true)
        .eq("is_assignable", true)
        .order("name", { ascending: true }),
      serviceSupabase
        .from("groups")
        .select(
          "id,event_id,name,public_label,parent_group_id,node_type,community_kind,age_bracket,is_active,is_assignable,is_public_catalog,primary_leader_name,public_order,events(title)"
        )
        .eq("event_id", currentEventId)
        .order("public_order", { ascending: true })
        .order("name", { ascending: true }),
      serviceSupabase
        .from("group_registration_links")
        .select(
          "id,event_id,group_id,public_label,internal_label,token_encrypted,use_count,max_uses,created_at,expires_at,revoked_at"
        )
        .eq("event_id", currentEventId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
      serviceSupabase
        .from("event_user_roles")
        .select("user_id,role,event_id,events(title)")
        .or(`event_id.is.null,event_id.eq.${currentEventId}`),
      serviceSupabase
        .from("group_memberships")
        .select("user_id,role,is_primary,group_id,groups!inner(id,name,event_id,events(title))")
        .eq("groups.event_id", currentEventId),
    ]);
    const registrationRows = (registrations ?? []) as AdminRegistrationRow[];
    const registrationIds = registrationRows.map((row) => row.id);
    const participantIds = registrationRows.map((row) => row.participant_id);
    const emptyResult = { data: [] };
    const [{ data: contacts }, { data: assignments }] = await Promise.all([
        participantIds.length > 0
          ? serviceSupabase
              .from("participant_contacts")
              .select("participant_id,email,phone")
              .in("participant_id", participantIds)
              .eq("is_primary", true)
          : Promise.resolve(emptyResult),
        registrationIds.length > 0
          ? serviceSupabase
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
      ((assignments ?? []) as AdminCurrentAssignmentRow[]).map((row) => [
        row.registration_id,
        row,
      ])
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
          country: participant?.country_other ?? null,
          city: participant?.city_other ?? null,
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
    const roleUsers = await buildOperationalUserRows(
      serviceSupabase,
      eventRoles,
      groupMemberships
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
      groupLinks: ((groupLinks ?? []) as AdminGroupRegistrationLinkRow[]).map(
        (link) => ({
          id: link.id,
          eventId: link.event_id,
          groupId: link.group_id,
          publicLabel: link.public_label,
          internalLabel: link.internal_label,
          url: buildGroupLinkUrlFromEncryptedToken(link.token_encrypted),
          useCount: link.use_count ?? 0,
          maxUses: link.max_uses,
          createdAt: link.created_at,
          expiresAt: link.expires_at,
          revokedAt: link.revoked_at,
        })
      ),
      roleUsers,
      filters,
      summary: summarizeOperationsDashboardParticipants(
        participantRows,
        filteredParticipants
      ),
    };
  }

  async function getAdminStatisticsSnapshot(
    groupTree: AdminGroupTreeRow[],
    currentEventId: string | null
  ): Promise<EventStatisticsSnapshot> {
    if (!currentEventId) {
      return buildEventStatisticsSnapshot({
        participants: [],
        groups: [],
        attendanceChoices: [],
      });
    }

    const { data: registrations } = await serviceSupabase
      .from("registrations")
      .select(
        "id,event_id,participant_id,status,submitted_at,events(title),participants(id,auth_user_id,first_name,last_name,public_code,country_other,city_other)"
      )
      .eq("event_id", currentEventId)
      .order("submitted_at", { ascending: false })
      .range(0, 9999);
    const registrationRows = (registrations ?? []) as AdminRegistrationRow[];
    const registrationIds = registrationRows.map((row) => row.id);
    const [{ data: assignments }, { data: attendanceChoices }] = await Promise.all([
      registrationIds.length > 0
        ? serviceSupabase
            .from("participant_group_assignments")
            .select(
              "registration_id,group_id,status,groups!participant_group_assignments_group_id_fkey(name)"
            )
            .in("registration_id", registrationIds)
            .eq("is_current", true)
        : Promise.resolve({ data: [] }),
      registrationIds.length > 0
        ? serviceSupabase
            .from("event_attendance_choices")
            .select("registration_id,day,choice")
            .in("registration_id", registrationIds)
        : Promise.resolve({ data: [] }),
    ]);
    const assignmentByRegistrationId = new Map(
      ((assignments ?? []) as AdminCurrentAssignmentRow[]).map((row) => [
        row.registration_id,
        row,
      ])
    );
    const participants = registrationRows.map((registration) => {
      const participant = relatedOne(registration.participants);
      const event = relatedOne(registration.events);
      const assignment = assignmentByRegistrationId.get(registration.id);
      const group = relatedOne(assignment?.groups ?? null);

      return {
        registrationId: registration.id,
        eventId: registration.event_id,
        eventTitle: event?.title ?? "Evento",
        participantId: registration.participant_id,
        authUserId: participant?.auth_user_id ?? null,
        name: formatParticipantName(
          participant?.first_name ?? null,
          participant?.last_name ?? null
        ),
        publicCode: participant?.public_code ?? null,
        country: participant?.country_other ?? null,
        city: participant?.city_other ?? null,
        place: formatPlace(participant?.city_other ?? null, participant?.country_other ?? null),
        email: null,
        phone: null,
        registrationStatus: registration.status,
        submittedAt: registration.submitted_at,
        currentGroupId: assignment?.group_id ?? null,
        currentGroupName: group?.name ?? null,
        currentGroupStatus: assignment?.status ?? null,
      };
    });

    return buildEventStatisticsSnapshot({
      participants,
      groups: groupTree,
      attendanceChoices: (attendanceChoices ?? []) as AttendanceChoiceRow[],
    });
  }

  async function getOpeningSnapshots(): Promise<EventSnapshot[]> {
    const { data: events } = await serviceSupabase
      .from("events")
      .select(
        "id,slug,title,status,is_current,city,country,starts_on,ends_on,registration_opens_at,registration_closes_at"
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

function AdminSidebar({
  activeSection,
  navMode,
}: {
  activeSection: AdminSection;
  navMode: AdminNavMode;
}) {
  const isMini = navMode === "mini";
  const nextMode = isMini ? "full" : "mini";
  const toggleLabel = isMini ? "Espandi menu" : "Comprimi menu";
  const items: Array<{
    key: AdminSection;
    href: string;
    Icon: typeof CalendarDays;
    label: string;
    help: string;
  }> = [
    {
      key: "evento",
      href: adminPath("evento", navMode),
      Icon: CalendarDays,
      label: "Gestione evento",
      help: "Apertura e monitoraggio",
    },
    {
      key: "dashboard",
      href: adminPath("dashboard", navMode),
      Icon: BarChart3,
      label: "Statistiche",
      help: "Evento e partecipanti",
    },
    {
      key: "iscritti",
      href: adminPath("iscritti", navMode),
      Icon: Users,
      label: "Gestione iscritti",
      help: "Elenco e modifiche",
    },
    {
      key: "ruoli",
      href: adminPath("ruoli", navMode),
      Icon: ShieldCheck,
      label: "Gestione ruoli",
      help: "Accessi operativi",
    },
    {
      key: "gruppi",
      href: adminPath("gruppi", navMode),
      Icon: Network,
      label: "Gestione gruppi",
      help: "Territori, gruppi e link",
    },
  ];

  return (
    <aside className="surface-card lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--peace-border)] p-2">
        <span className={isMini ? "sr-only" : "px-2 text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]"}>
          Admin
        </span>
        <Link
          href={adminPath(activeSection, nextMode)}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="btn-secondary grid min-h-9 min-w-9 place-items-center px-2 text-sm"
        >
          <span aria-hidden="true">{isMini ? "›" : "‹"}</span>
        </Link>
      </div>
      <nav aria-label="Sezioni dashboard admin" className="grid gap-1.5 p-2">
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

function AdminEventSection({
  snapshots,
  isCreatingEvent,
  navMode,
}: {
  snapshots: EventSnapshot[];
  isCreatingEvent: boolean;
  navMode: AdminNavMode;
}) {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="surface-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Apertura e monitoraggio</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            Usa questi comandi solo durante finestre operative concordate.
            Ogni modifica viene registrata negli audit.
          </p>
        </div>
        <Link
          href={adminPath("evento", navMode, "eventTool=new")}
          scroll={false}
          className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
        >
          Nuovo evento futuro
        </Link>
      </div>

      {snapshots.map((snapshot) => (
        <EventOpeningCard key={snapshot.event.id} snapshot={snapshot} />
      ))}

      {snapshots.length === 0 ? (
        <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5 text-sm text-[var(--peace-muted)]">
          Nessun evento visibile.
        </div>
      ) : null}

      {isCreatingEvent ? <NewEventOverlay navMode={navMode} /> : null}
    </section>
  );
}

function StatisticsSection({
  statistics,
  basePath,
  navMode,
  activeLevel,
}: {
  statistics: EventStatisticsSnapshot;
  basePath: "/dashboard/admin" | "/dashboard/manager";
  navMode: AdminNavMode;
  activeLevel: ParticipantBreakdownLevel;
}) {
  const breakdownRows = statistics.participantBreakdowns[activeLevel];
  const tabs: Array<{ key: ParticipantBreakdownLevel; label: string }> = [
    { key: "country", label: "Paesi" },
    { key: "city", label: "Città" },
    { key: "group", label: "Gruppi" },
  ];

  return (
    <section className="grid min-w-0 gap-4">
      <div className="surface-panel p-5">
        <h2 className="text-lg font-semibold">Statistiche evento</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
          Lettura operativa dei partecipanti per territorio e delle presenze
          giornaliere indicate in iscrizione.
        </p>
      </div>

      <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold">Partecipanti per territorio e gruppi</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
              Scegli se leggere le iscrizioni per paese, città o gruppo assegnato.
            </p>
          </div>
          <div className="inline-flex w-fit rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-1">
            {tabs.map((tab) => {
              const isActive = tab.key === activeLevel;

              return (
                <Link
                  key={tab.key}
                  href={statisticsPath(basePath, navMode, tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "inline-flex min-h-9 items-center rounded px-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-[var(--peace-blue-800)] shadow-sm"
                      : "text-[var(--peace-muted)] hover:text-[var(--peace-ink)]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">{participantBreakdownLabel(activeLevel)}</th>
                <th className="py-3 text-right font-semibold">Partecipanti</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="py-4 pr-4 font-semibold text-[var(--peace-ink)]">
                    {row.label}
                  </td>
                  <td className="py-4 text-right text-xl font-semibold text-[var(--peace-ink)]">
                    {row.participantCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {breakdownRows.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--peace-muted)]">
            Nessun partecipante da aggregare.
          </p>
        ) : null}
      </article>

      <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <div>
          <h3 className="text-base font-semibold">Presenze indicate per giornata</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
            Conteggio delle iscrizioni con presenza confermata per giorno e di
            quelle senza nessun giorno selezionato.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Giornata</th>
                <th className="py-3 text-right font-semibold">Partecipanti</th>
              </tr>
            </thead>
            <tbody>
              {statistics.attendanceByDay.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--peace-border)] last:border-b-0"
                >
                  <td className="py-4 pr-4 font-semibold text-[var(--peace-ink)]">
                    {row.kind === "day" ? formatDate(row.label) : row.label}
                  </td>
                  <td className="py-4 text-right text-xl font-semibold text-[var(--peace-ink)]">
                    {row.participantCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {statistics.attendanceByDay.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--peace-muted)]">
            Nessuna presenza giornaliera disponibile.
          </p>
        ) : null}
      </article>
    </section>
  );
}

function adminPath(
  section: AdminSection,
  navMode: AdminNavMode,
  extraParams?: string
): string {
  const params = new URLSearchParams({ section, nav: navMode });

  if (extraParams) {
    new URLSearchParams(extraParams).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return `/dashboard/admin?${params.toString()}`;
}

function adminRoleEditPath(
  role: OperationalUserRoleRow,
  navMode: AdminNavMode
): string {
  const params = new URLSearchParams({
    roleUserId: role.userId,
  });

  return adminPath("ruoli", navMode, params.toString());
}

function statisticsPath(
  basePath: "/dashboard/admin" | "/dashboard/manager",
  navMode: AdminNavMode,
  level: ParticipantBreakdownLevel
): string {
  const params = new URLSearchParams({
    section: "dashboard",
    nav: navMode,
    stat: level,
  });

  return `${basePath}?${params.toString()}`;
}

async function buildOperationalUserRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  eventRoles: unknown,
  groupMemberships: unknown
): Promise<OperationalUserRoleRow[]> {
  const eventRoleRows = (eventRoles ?? []) as Array<{
    user_id: string;
    role: string;
    event_id: string | null;
    events: { title: string | null } | Array<{ title: string | null }> | null;
  }>;
  const membershipRows = (groupMemberships ?? []) as Array<{
    user_id: string;
    role: string;
    is_primary: boolean | null;
    group_id: string | null;
    groups:
      | {
          id: string;
          name: string | null;
          event_id: string | null;
          events: { title: string | null } | Array<{ title: string | null }> | null;
        }
      | Array<{
          id: string;
          name: string | null;
          event_id: string | null;
          events: { title: string | null } | Array<{ title: string | null }> | null;
        }>
      | null;
  }>;
  const userIds = Array.from(
    new Set([
      ...eventRoleRows.map((row) => row.user_id),
      ...membershipRows.map((row) => row.user_id),
    ])
  );

  const identityByUserId = await getOperationalUserIdentities(supabase, userIds);

  const assignments: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
    assignment: OperationalUserRoleAssignment;
  }> = [
    ...eventRoleRows.map((row) => {
      const identity = identityByUserId.get(row.user_id);
      return {
        userId: row.user_id,
        email: identity?.email ?? null,
        fullName: identity?.fullName ?? null,
        assignment: {
          role: row.role,
          isPrimaryGroupLeader: null,
          eventId: row.event_id,
          eventTitle: relatedOne(row.events)?.title ?? null,
          groupId: null,
          groupName: null,
        },
      };
    }),
    ...membershipRows.map((row) => {
      const group = relatedOne(row.groups);
      const identity = identityByUserId.get(row.user_id);
      return {
        userId: row.user_id,
        email: identity?.email ?? null,
        fullName: identity?.fullName ?? null,
        assignment: {
          role: row.role,
          isPrimaryGroupLeader: row.is_primary ?? false,
          eventId: group?.event_id ?? null,
          eventTitle: relatedOne(group?.events ?? null)?.title ?? null,
          groupId: group?.id ?? row.group_id,
          groupName: group?.name ?? null,
        },
      };
    }),
  ];

  return aggregateOperationalUserRows(assignments).sort((a, b) =>
    (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? "")
  );
}

function aggregateOperationalUserRows(
  assignments: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
    assignment: OperationalUserRoleAssignment;
  }>
): OperationalUserRoleRow[] {
  const rowsByKey = new Map<string, OperationalUserRoleRow>();

  for (const item of assignments) {
    const key = item.email ? `email:${item.email.toLowerCase()}` : `user:${item.userId}`;
    const row =
      rowsByKey.get(key) ??
      {
        userId: item.userId,
        email: item.email,
        fullName: item.fullName,
        assignments: [],
        eventRoles: [],
        groupLeaderAssignments: [],
      };

    row.email ||= item.email;
    row.fullName ||= item.fullName;
    row.assignments.push(item.assignment);

    if (item.assignment.role === "capogruppo") {
      row.groupLeaderAssignments.push(item.assignment);
    } else {
      row.eventRoles.push(item.assignment);
    }

    rowsByKey.set(key, row);
  }

  return [...rowsByKey.values()].map((row) => ({
    ...row,
    assignments: deduplicateOperationalAssignments(row.assignments),
    eventRoles: deduplicateOperationalAssignments(row.eventRoles),
    groupLeaderAssignments: deduplicateOperationalAssignments(row.groupLeaderAssignments),
  }));
}

function deduplicateOperationalAssignments(
  assignments: OperationalUserRoleAssignment[]
): OperationalUserRoleAssignment[] {
  const seen = new Set<string>();

  return assignments.filter((assignment) => {
    const key = [
      assignment.role,
      assignment.eventId ?? "no-event",
      assignment.groupId ?? "no-group",
      assignment.isPrimaryGroupLeader === null
        ? "no-primary-flag"
        : String(assignment.isPrimaryGroupLeader),
    ].join(":");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function NewEventOverlay({ navMode }: { navMode: AdminNavMode }) {
  return (
    <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-[rgba(16,36,64,0.42)] px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Nuovo evento futuro</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
              L&apos;evento viene creato in bozza e non diventa corrente finché
              un admin non lo rende operativo.
            </p>
          </div>
          <Link
            href={adminPath("evento", navMode)}
            scroll={false}
            aria-label="Chiudi"
            className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--peace-border)] text-[var(--peace-muted)] transition hover:bg-[var(--peace-sky-100)]"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <form action={createFutureEvent} className="mt-5 grid gap-4" data-preserve-dashboard-scroll>
          <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
            Titolo evento
            <input name="title" className="field" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
            Slug tecnico
            <input
              name="slug"
              className="field"
              placeholder="assisi-2027"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Città
              <input name="city" className="field" required />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Paese
              <input name="country" className="field" defaultValue="Italia" required />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Inizio evento
              <input name="startsOn" type="date" className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Fine evento
              <input name="endsOn" type="date" className="field" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Apertura iscrizioni
              <input name="registrationOpensAt" type="datetime-local" className="field" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
              Chiusura iscrizioni
              <input name="registrationClosesAt" type="datetime-local" className="field" />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--peace-border)] pt-4">
            <Link
              href={adminPath("evento", navMode)}
              scroll={false}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-ink)] transition hover:bg-[var(--peace-sky-100)]"
            >
              Annulla
            </Link>
            <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Crea evento in bozza
            </PendingSubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventOpeningCard({ snapshot }: { snapshot: EventSnapshot }) {
  const { event, summary } = snapshot;
  const isOpen = snapshot.openingState === "open";
  const isHidden = snapshot.openingState === "not-published";
  const openLabel =
    snapshot.openingState === "scheduled"
      ? "Apri subito"
      : snapshot.openingState === "closed"
        ? "Riapri iscrizioni"
        : "Pubblica e apri";

  return (
    <article className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{event.title}</h3>
            <span className="rounded-full border border-[var(--peace-border-strong)] bg-[var(--peace-sky-100)] px-3 py-1 text-xs font-semibold text-[var(--peace-blue-800)]">
              {openingStateLabel(snapshot.openingState)}
            </span>
            {event.is_current ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Evento corrente
              </span>
            ) : null}
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

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {event.is_current ? (
            <DisabledAction label="È l'evento corrente" />
          ) : (
            <form action={setCurrentOperationalEvent}>
              <input type="hidden" name="eventId" value={event.id} />
              <PendingSubmitButton className="min-h-11 w-full rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
                Rendi corrente
              </PendingSubmitButton>
            </form>
          )}
          {isOpen ? (
            <DisabledAction label="Iscrizioni aperte" primary />
          ) : (
            <OpeningForm
              eventId={event.id}
              intent="open"
              label={openLabel}
              tone="primary"
            />
          )}
          {isOpen || snapshot.openingState === "scheduled" ? (
            <OpeningForm
              eventId={event.id}
              intent="pause"
              label="Sospendi iscrizioni"
              tone="secondary"
            />
          ) : null}
          {isHidden ? (
            <DisabledAction label="Evento nascosto" />
          ) : (
            <OpeningForm
              eventId={event.id}
              intent="draft"
              label="Nascondi evento"
              tone="secondary"
            />
          )}
        </div>
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

function AdminParticipantsSection({
  snapshot,
  selectedParticipant,
  isEditingParticipant,
  navMode,
}: {
  snapshot: AdminOperationsSnapshot;
  selectedParticipant: AdminParticipantRow | null;
  isEditingParticipant: boolean;
  navMode: AdminNavMode;
}) {
  const currentGroupOptions = getCurrentGroupFilterOptions(snapshot.allParticipants);

  return (
    <section className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Gestione iscritti</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
          Ultime iscrizioni, fino a 200 risultati recenti.
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <AutoFilterForm
          action="/dashboard/admin"
          defaults={{ q: "", contact: "", group: "all", status: "all" }}
        >
          <input type="hidden" name="section" value="iscritti" />
          <input type="hidden" name="nav" value={navMode} />
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Iscrizione</th>
                <th className="py-3 pr-4 font-semibold">Contatti</th>
                <th className="py-3 pr-4 font-semibold">Gruppo</th>
                <th className="py-3 text-right font-semibold">Azioni</th>
              </tr>
              <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] align-top">
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-participant-q">Cerca iscrizione</label>
                  <input
                    id="admin-participant-q"
                    name="q"
                    defaultValue={snapshot.filters.q}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Nome, codice, email"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-participant-contact">Cerca contatto</label>
                  <input
                    id="admin-participant-contact"
                    name="contact"
                    defaultValue={snapshot.filters.contact}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Email, telefono"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-participant-group">Gruppo</label>
                  <select
                    id="admin-participant-group"
                    name="group"
                    defaultValue={snapshot.filters.group}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i gruppi</option>
                    <option value="none">Senza gruppo</option>
                    {currentGroupOptions.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <label className="sr-only" htmlFor="admin-participant-status">Stato</label>
                    <select
                      id="admin-participant-status"
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
                        href={adminPath("iscritti", navMode)}
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
              {snapshot.participants.map((participant) => (
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
                    <Link
                      href={adminPath(
                        "iscritti",
                        navMode,
                        `edit=${encodeURIComponent(participant.registrationId)}`
                      )}
                      scroll={false}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                    >
                      Dettagli
                    </Link>
                  </td>
                </tr>
              ))}
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
        <AdminParticipantEditOverlay
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

function AdminOperationalUsersSection({
  roles,
  eventOptions,
  groupOptions,
  selectedRole,
  navMode,
}: {
  roles: OperationalUserRoleRow[];
  eventOptions: Array<{ id: string; title: string }>;
  groupOptions: AdminGroupTreeRow[];
  selectedRole: OperationalUserRoleRow | null;
  navMode: AdminNavMode;
}) {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h2 className="text-lg font-semibold">Utenti e ruoli</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
          Crea accessi operativi con email, nome e cognome senza creare una
          iscrizione per l&apos;evento. Manager, admin e accoglienza accedono
          direttamente alla dashboard operativa; solo il capogruppo completa
          anche l&apos;iscrizione personale.
        </p>

        <form action={assignOperationalUserRole} className="mt-5 grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
          <input type="hidden" name="sourceDashboard" value="admin" />
          <input type="hidden" name="nav" value={navMode} />
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Nome
              <input name="firstName" className="field bg-white font-normal" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Cognome
              <input name="lastName" className="field bg-white font-normal" required />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Email
              <input name="email" type="email" className="field bg-white font-normal" required />
            </label>
          </div>
          <OperationalRoleFields
            eventOptions={eventOptions}
            groupOptions={groupOptions.map((group) => ({
              id: group.id,
              name: group.name,
              eventTitle: group.eventTitle,
            }))}
            roleOptions={[
              { value: "capogruppo", label: "Capogruppo" },
              { value: "manager", label: "Manager" },
              { value: "manager_viewer", label: "Manager viewer" },
              { value: "accoglienza", label: "Accoglienza" },
              { value: "admin", label: "Admin globale" },
            ]}
            showInviteOption
          />
          <PendingSubmitButton className="min-h-11 w-fit rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
            Crea utente e assegna ruolo
          </PendingSubmitButton>
        </form>
      </div>

      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h3 className="text-base font-semibold">Ruoli assegnati</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Utente</th>
                <th className="py-3 pr-4 font-semibold">Ruolo</th>
                <th className="py-3 pr-4 font-semibold">Responsabilità</th>
                <th className="py-3 pr-4 font-semibold">Stato iscrizione</th>
                <th className="py-3 font-semibold">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((row) => (
                <tr key={operationalRoleRowKey(row)} className="border-b border-[var(--peace-border)] align-top last:border-b-0">
                  <td className="py-4 pr-4">
                    <p className="font-semibold">{row.fullName ?? row.email ?? "Utente senza profilo"}</p>
                    <p className="mt-1 text-xs text-[var(--peace-muted)]">{row.email ?? row.userId}</p>
                  </td>
                  <td className="py-4 pr-4">{operationalRoleSummary(row)}</td>
                  <td className="py-4 pr-4 text-[var(--peace-muted)]">
                    <OperationalResponsibilityList row={row} />
                  </td>
                  <td className="py-4 pr-4 text-[var(--peace-muted)]">
                    Accesso operativo attivo; iscrizione personale separata.
                  </td>
                  <td className="py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={adminRoleEditPath(row, navMode)}
                        scroll={false}
                        aria-label={`Modifica ${row.fullName ?? row.email ?? "utente operativo"}`}
                        title={`Modifica ${row.fullName ?? row.email ?? "utente operativo"}`}
                        className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)] focus:outline-none focus:ring-2 focus:ring-[var(--peace-sky-300)]"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {roles.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--peace-muted)]">Nessun ruolo assegnato.</p>
        ) : null}
      </div>

      {selectedRole ? (
        <AdminOperationalRoleEditOverlay
          role={selectedRole}
          eventOptions={eventOptions}
          groupOptions={groupOptions}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function AdminOperationalRoleEditOverlay({
  role,
  eventOptions,
  groupOptions,
  navMode,
}: {
  role: OperationalUserRoleRow;
  eventOptions: Array<{ id: string; title: string }>;
  groupOptions: AdminGroupTreeRow[];
  navMode: AdminNavMode;
}) {
  const nameParts = splitFullName(role.fullName);
  const currentAssignment = preferredOperationalAssignment(role);

  return (
    <div className="dashboard-modal fixed inset-0 z-50 grid place-items-center bg-[rgba(16,36,64,0.42)] px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Modifica utente operativo</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">
              Aggiorna dati, ruolo e responsabilità della persona selezionata.
            </p>
          </div>
          <Link
            href={`/dashboard/admin?section=ruoli&nav=${navMode}`}
            scroll={false}
            aria-label="Chiudi"
            className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--peace-border)] text-[var(--peace-muted)] transition hover:bg-[var(--peace-sky-100)]"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <form action={updateOperationalUserRole} className="mt-5 grid gap-4" data-preserve-dashboard-scroll>
          <input type="hidden" name="sourceDashboard" value="admin" />
          <input type="hidden" name="nav" value={navMode} />
          <input type="hidden" name="currentUserId" value={role.userId} />
          <input type="hidden" name="currentRole" value={preferredOperationalRole(role)} />
          <input type="hidden" name="currentEventId" value={currentAssignment?.eventId ?? ""} />
          <input type="hidden" name="currentGroupId" value={currentAssignment?.groupId ?? ""} />
          <div className="grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Nome
              <input
                name="firstName"
                className="field bg-white font-normal"
                defaultValue={nameParts.firstName}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Cognome
              <input
                name="lastName"
                className="field bg-white font-normal"
                defaultValue={nameParts.lastName}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Email
              <input
                name="email"
                type="email"
                className="field bg-white font-normal"
                defaultValue={role.email ?? ""}
                readOnly
                required
              />
            </label>
          </div>
          <OperationalRoleFields
            eventOptions={eventOptions}
            groupOptions={groupOptions.map((group) => ({
              id: group.id,
              name: group.name,
              eventTitle: group.eventTitle,
            }))}
            roleOptions={[
              { value: "capogruppo", label: "Capogruppo" },
              { value: "manager", label: "Manager" },
              { value: "manager_viewer", label: "Manager viewer" },
              { value: "accoglienza", label: "Accoglienza" },
              { value: "admin", label: "Admin globale" },
            ]}
            defaultRole={preferredOperationalRole(role)}
            defaultEventId={role.eventRoles[0]?.eventId ?? role.groupLeaderAssignments[0]?.eventId}
            defaultGroupIds={role.groupLeaderAssignments
              .map((assignment) => assignment.groupId)
              .filter((groupId): groupId is string => Boolean(groupId))}
            defaultLeaderKind={role.groupLeaderAssignments.some(
              (assignment) => assignment.isPrimaryGroupLeader
            )
              ? "primary"
              : "secondary"}
            allowMultipleGroupLeaders
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Link
              href={`/dashboard/admin?section=ruoli&nav=${navMode}`}
              scroll={false}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-ink)] transition hover:bg-[var(--peace-sky-100)]"
            >
              Annulla
            </Link>
            <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Salva modifiche
            </PendingSubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminGroupTreeSection({
  groups,
  links,
  participants,
  roleUsers,
  currentEventOption,
  filters,
  selectedGroup,
  selectedTool,
  createdGroupId,
  createdUrl,
  navMode,
}: {
  groups: AdminGroupTreeRow[];
  links: AdminGroupRegistrationLink[];
  participants: AdminParticipantRow[];
  roleUsers: OperationalUserRoleRow[];
  currentEventOption: { id: string; title: string } | null;
  filters: GroupTableFilters;
  selectedGroup: AdminGroupTreeRow | null;
  selectedTool: "edit" | "links" | "leaders" | null;
  createdGroupId: string | null;
  createdUrl: string | null;
  navMode: AdminNavMode;
}) {
  const filteredGroups = filterGroupRows(groups, filters);
  const linksByGroupId = groupLinksByGroupId(links);
  const eventOptions = currentEventOption
    ? [currentEventOption]
    : getGroupEventOptions(groups);

  return (
    <section className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gruppi</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
            Gestisci gruppi, nodi territoriali e link riservati per le iscrizioni.
          </p>
        </div>
        <Link
          href={adminPath("gruppi", navMode, "groupTool=edit")}
          scroll={false}
          className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
        >
          Nuovo gruppo
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <EventValue label="Gruppi visibili" value={filteredGroups.length} />
        <EventValue label="Iscrivibili" value={filteredGroups.filter((group) => group.isAssignable).length} />
        <EventValue label="Nel form pubblico" value={filteredGroups.filter((group) => group.isPublicCatalog).length} />
        <EventValue label="Link attivi" value={links.length} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <AutoFilterForm
          action="/dashboard/admin"
          defaults={{
            groupQ: "",
            groupType: "all",
            groupVisibility: "all",
          }}
        >
          <input type="hidden" name="section" value="gruppi" />
          <input type="hidden" name="nav" value={navMode} />
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Nodo</th>
                <th className="py-3 pr-4 font-semibold">Età</th>
                <th className="py-3 pr-4 font-semibold">Referente principale</th>
                <th className="py-3 pr-4 font-semibold">Accesso iscrizione</th>
                <th className="py-3 text-right font-semibold">Azioni</th>
              </tr>
              <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] align-top">
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-group-q">Cerca gruppo</label>
                  <input
                    id="admin-group-q"
                    name="groupQ"
                    defaultValue={filters.q}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Nome, referente, label"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-group-type">Tipo nodo</label>
                  <select
                    id="admin-group-type"
                    name="groupType"
                    defaultValue={filters.nodeType}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i tipi</option>
                    <option value="country">Paese</option>
                    <option value="city">Città</option>
                    <option value="area">Area</option>
                    <option value="group">Gruppo</option>
                    <option value="newcomers">Nuovi partecipanti</option>
                  </select>
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="admin-group-visibility">Accesso iscrizione</label>
                  <select
                    id="admin-group-visibility"
                    name="groupVisibility"
                    defaultValue={filters.visibility}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti</option>
                    <option value="public">Nel form pubblico</option>
                    <option value="reserved">Solo con link</option>
                    <option value="not-assignable">Non iscrivibile</option>
                  </select>
                </th>
                <th className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {filters.q ||
                    filters.eventId !== "all" ||
                    filters.nodeType !== "all" ||
                    filters.visibility !== "all" ? (
                      <Link
                        href={adminPath("gruppi", navMode)}
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
            {filteredGroups.map((group) => {
              return (
                <tr
                  key={group.id}
                  className="border-b border-[var(--peace-border)] align-top last:border-b-0"
                >
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[var(--peace-ink)]">{group.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--peace-muted)]">
                      {groupNodeTypeLabel(group.nodeType)}
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
                      <Link
                        href={adminPath(
                          "gruppi",
                          navMode,
                          `groupTool=edit&groupId=${encodeURIComponent(group.id)}`
                        )}
                        scroll={false}
                        className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                      >
                        Modifica
                      </Link>
                      <Link
                        href={adminPath(
                          "gruppi",
                          navMode,
                          `groupTool=links&groupId=${encodeURIComponent(group.id)}`
                        )}
                        scroll={false}
                        className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                      >
                        Gestisci link
                      </Link>
                      <Link
                        href={adminPath(
                          "gruppi",
                          navMode,
                          `groupTool=leaders&groupId=${encodeURIComponent(group.id)}`
                        )}
                        scroll={false}
                        className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                      >
                        Capogruppo
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </AutoFilterForm>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--peace-muted)]">
          Nessun gruppo corrisponde ai filtri correnti.
        </p>
      ) : null}

      {selectedTool === "edit" ? (
        <AdminGroupEditOverlay
          group={selectedGroup}
          groups={groups}
          eventOptions={eventOptions}
          leaders={roleUsers}
          navMode={navMode}
        />
      ) : null}

      {selectedTool === "links" && selectedGroup ? (
        <AdminGroupLinksOverlay
          group={selectedGroup}
          links={linksByGroupId.get(selectedGroup.id) ?? []}
          createdUrl={createdGroupId === selectedGroup.id ? createdUrl : null}
          navMode={navMode}
        />
      ) : null}

      {selectedTool === "leaders" && selectedGroup ? (
        <AdminGroupLeaderOverlay
          group={selectedGroup}
          participants={participants.filter(
            (participant) => participant.eventId === selectedGroup.eventId
          )}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function AdminGroupEditOverlay({
  group,
  groups,
  eventOptions,
  leaders,
  navMode,
}: {
  group: AdminGroupTreeRow | null;
  groups: AdminGroupTreeRow[];
  eventOptions: Array<{ id: string; title: string }>;
  leaders: OperationalUserRoleRow[];
  navMode: AdminNavMode;
}) {
  const selectedEventId = group?.eventId ?? eventOptions[0]?.id ?? "";

  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-[var(--peace-border)] px-5 py-4">
          <h3 className="text-xl font-semibold">
            {group ? "Modifica gruppo" : "Nuovo gruppo"}
          </h3>
        </div>
        <form action={saveOperationsGroup} className="grid overflow-y-auto" data-preserve-dashboard-scroll>
          <input type="hidden" name="sourceDashboard" value="admin" />
          {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <GroupPlacementFields
              group={group}
              groups={groups}
              eventId={selectedEventId}
            />
            <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)] sm:col-span-2">
              Nome gruppo
              <input name="name" defaultValue={group?.name ?? ""} className="field" required />
            </label>
            <GroupPrimaryLeaderFields
              group={group}
              leaders={operationalRowsForGroupEdit(leaders)}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--peace-border)] px-5 py-4">
            <Link href={adminPath("gruppi", navMode)} scroll={false} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
              Annulla
            </Link>
            <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Salva gruppo
            </PendingSubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminGroupLinksOverlay({
  group,
  links,
  createdUrl,
  navMode,
}: {
  group: AdminGroupTreeRow;
  links: AdminGroupRegistrationLink[];
  createdUrl: string | null;
  navMode: AdminNavMode;
}) {
  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Link gruppo</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
          </div>
          <Link
            href={adminPath("gruppi", navMode)}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label="Chiudi modale link gruppo"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          <AutoCopyLinkNotice url={createdUrl} />
          <form action={createGroupRegistrationLink} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4" data-preserve-dashboard-scroll>
            <input type="hidden" name="sourceDashboard" value="admin" />
            <input type="hidden" name="groupId" value={group.id} />
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Nome visualizzato del link
              <input
                name="displayName"
                className="field"
                defaultValue={group.publicLabel ?? group.name}
                required
              />
            </label>
            <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
              Genera link
            </PendingSubmitButton>
          </form>

          <div className="grid gap-2">
            {links.map((link) => (
              <div key={link.id} className="flex flex-col gap-2 rounded-md border border-[var(--peace-border)] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--peace-ink)]">
                    {link.publicLabel ?? "Link senza nome"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--peace-muted)]">
                    {groupLinkStatusLabel(link)} - usi {link.useCount}
                    {link.maxUses ? `/${link.maxUses}` : ""}
                  </p>
                  {link.url ? (
                    <input
                      readOnly
                      className="field mt-2 bg-[#f7fbfe] font-mono text-xs"
                      value={link.url}
                    />
                  ) : (
                    <p className="mt-2 text-xs text-[var(--peace-muted)]">
                      Link creato prima della copia persistente: genera un nuovo link per poterlo copiare da qui.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {link.url ? <CopyLinkButton url={link.url} /> : null}
                  <form action={revokeGroupRegistrationLink} data-preserve-dashboard-scroll>
                    <input type="hidden" name="sourceDashboard" value="admin" />
                    <input type="hidden" name="linkId" value={link.id} />
                    <PendingSubmitButton className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-xs font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]">
                      Revoca
                    </PendingSubmitButton>
                  </form>
                </div>
              </div>
            ))}
            {links.length === 0 ? (
              <p className="text-sm text-[var(--peace-muted)]">Nessun link attivo per questo gruppo.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminGroupLeaderOverlay({
  group,
  participants,
  navMode,
}: {
  group: AdminGroupTreeRow;
  participants: AdminParticipantRow[];
  navMode: AdminNavMode;
}) {
  const participantOptions = participants.filter((participant) => participant.email);

  return (
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Assegna capogruppo</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
          </div>
          <Link
            href={adminPath("gruppi", navMode)}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label="Chiudi modale capogruppo"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <GroupLeaderModeTabs
            existingForm={
              <form action={assignGroupLeader} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4" data-preserve-dashboard-scroll>
                <input type="hidden" name="sourceDashboard" value="admin" />
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="mode" value="existing" />
                <ParticipantSearchField
                  label="Partecipante già iscritto"
                  name="participantId"
                  options={participantOptions.map((participant) => ({
                    id: participant.participantId,
                    name: participant.name,
                    email: participant.email,
                  }))}
                />
                <div className="pt-3">
                  <GroupLeaderKindField />
                </div>
                <PendingSubmitButton className="min-h-10 rounded-md bg-[var(--peace-blue-800)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                  Assegna capogruppo
                </PendingSubmitButton>
              </form>
            }
            newForm={
              <form action={assignGroupLeader} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-white p-4" data-preserve-dashboard-scroll>
                <input type="hidden" name="sourceDashboard" value="admin" />
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
                <GroupLeaderKindField />
                <PendingSubmitButton className="min-h-10 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
                  Crea utente e assegna
                </PendingSubmitButton>
              </form>
            }
          />
        </div>
      </div>
    </div>
  );
}

function AdminParticipantEditOverlay({
  participant,
  groupOptions,
  isEditing,
  navMode,
}: {
  participant: AdminParticipantRow;
  groupOptions: AdminGroupOption[];
  isEditing: boolean;
  navMode: AdminNavMode;
}) {
  const includesCurrentGroup =
    !participant.currentGroupId ||
    groupOptions.some((group) => group.id === participant.currentGroupId);
  const visibleGroupOptions: AdminGroupOption[] =
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
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
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
              data-preserve-dashboard-scroll
            >
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
              <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                Salva gruppo
              </PendingSubmitButton>
            </form>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--peace-border)] px-5 py-4">
          <Link
            href={adminPath("iscritti", navMode)}
            scroll={false}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Chiudi
          </Link>
          {!isEditing ? (
            <Link
              href={adminPath(
                "iscritti",
                navMode,
                `edit=${encodeURIComponent(participant.registrationId)}&editMode=1`
              )}
              scroll={false}
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

function DisabledAction({
  label,
  primary = false,
}: {
  label: string;
  primary?: boolean;
}) {
  const className = primary
    ? "min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white opacity-55"
    : "min-h-11 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] px-4 text-sm font-semibold text-[var(--peace-muted)]";

  return (
    <button type="button" className={className} disabled>
      {label}
    </button>
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
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="intent" value={intent} />
      <PendingSubmitButton className={className}>
        {label}
      </PendingSubmitButton>
    </form>
  );
}

function StatusMessage({
  error,
  saved,
  adminError,
  adminSaved,
  groupError,
  groupSaved,
  groupLinkError,
  groupLinkSaved,
  roleError,
  roleSaved,
}: {
  error?: string;
  saved?: string;
  adminError?: string;
  adminSaved?: string;
  groupError?: string;
  groupSaved?: string;
  groupLinkError?: string;
  groupLinkSaved?: string;
  roleError?: string;
  roleSaved?: string;
}) {
  if (saved || adminSaved || groupSaved || groupLinkSaved || roleSaved) {
    return (
      <p className="rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        {groupSaved
          ? "Gruppo aggiornato."
          : groupLinkSaved
            ? "Link gruppo aggiornato."
            : roleSaved
              ? "Utente operativo aggiornato."
            : adminSaved
              ? "Gestione iscritti aggiornata."
              : saved === "created"
                ? "Evento futuro creato in bozza."
                : "Configurazione apertura aggiornata."}
      </p>
    );
  }

  if (!error && !adminError && !groupError && !groupLinkError && !roleError) {
    return null;
  }

  const messages: Record<string, string> = {
    invalid: "Comando apertura non valido.",
    "invalid-dates": "Le date indicate non sono coerenti.",
    "not-found": "Evento non trovato.",
    "invalid-group": "Gruppo non valido per questa iscrizione.",
    "invalid-parent": "Il gruppo parent non è valido per questo evento.",
    "missing-event": "Seleziona un evento per questo ruolo.",
    "missing-group": "Seleziona un gruppo per il ruolo capogruppo.",
    "auth-user": "Non è stato possibile creare o recuperare l'utente.",
    "email-taken": "Questa email è già associata a un altro utente operativo.",
    "invite-email": "Ruolo assegnato, ma non è stato possibile inviare l'email di invito.",
    "self-role": "Non puoi revocare o spostare il ruolo con cui stai operando.",
    forbidden: "Non hai permessi di modifica su questo evento.",
  };
  const messageKey = groupError ?? groupLinkError ?? roleError ?? adminError ?? error;

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

function getCurrentGroupFilterOptions(
  participants: AdminParticipantRow[]
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

function resolveAdminSection(input: { section?: string }): AdminSection {
  if (
    input.section === "evento" ||
    input.section === "dashboard" ||
    input.section === "iscritti" ||
    input.section === "ruoli" ||
    input.section === "gruppi"
  ) {
    return input.section;
  }

  return "evento";
}

function resolveParticipantBreakdownLevel(
  value: string | undefined
): ParticipantBreakdownLevel {
  if (value === "city" || value === "group") {
    return value;
  }

  return "country";
}

function participantBreakdownLabel(level: ParticipantBreakdownLevel): string {
  switch (level) {
    case "city":
      return "Città";
    case "group":
      return "Gruppo";
    case "country":
      return "Paese";
  }
}

function roleLabel(role: string, isPrimaryGroupLeader?: boolean | null): string {
  switch (role) {
    case "admin":
      return "Admin globale";
    case "manager":
      return "Manager";
    case "manager_viewer":
      return "Manager viewer";
    case "accoglienza":
      return "Accoglienza";
    case "capogruppo":
      return isPrimaryGroupLeader ? "Capogruppo principale" : "Capogruppo secondario";
    default:
      return role;
  }
}

function operationalRoleRowKey(row: OperationalUserRoleRow): string {
  return row.email ? `email:${row.email.toLowerCase()}` : `user:${row.userId}`;
}

function preferredOperationalRole(row: OperationalUserRoleRow): string {
  return row.groupLeaderAssignments.length > 0
    ? "capogruppo"
    : (row.eventRoles[0]?.role ?? row.assignments[0]?.role ?? "manager");
}

function preferredOperationalAssignment(
  row: OperationalUserRoleRow
): OperationalUserRoleAssignment | null {
  return row.groupLeaderAssignments[0] ?? row.eventRoles[0] ?? row.assignments[0] ?? null;
}

function operationalRoleSummary(row: OperationalUserRoleRow): string {
  const labels = new Set<string>();

  for (const assignment of row.eventRoles) {
    labels.add(roleLabel(assignment.role));
  }

  if (row.groupLeaderAssignments.length > 0) {
    const hasPrimary = row.groupLeaderAssignments.some(
      (assignment) => assignment.isPrimaryGroupLeader
    );
    const hasSecondary = row.groupLeaderAssignments.some(
      (assignment) => !assignment.isPrimaryGroupLeader
    );

    labels.add(
      hasPrimary && hasSecondary
        ? "Capogruppo principale e secondario"
        : hasPrimary
          ? "Capogruppo principale"
          : "Capogruppo secondario"
    );
  }

  return [...labels].join(", ") || "Ruolo non indicato";
}

function OperationalResponsibilityList({ row }: { row: OperationalUserRoleRow }) {
  const eventLabels = Array.from(
    new Set(
      row.eventRoles.map((assignment) =>
        assignment.role === "admin"
          ? "Globale"
          : (assignment.eventTitle ?? "Evento corrente")
      )
    )
  );
  const primaryGroups = groupNamesForLeaderKind(row, true);
  const secondaryGroups = groupNamesForLeaderKind(row, false);

  return (
    <div className="grid gap-1">
      {eventLabels.map((label) => (
        <p key={`event-${label}`}>{label}</p>
      ))}
      {primaryGroups.length > 0 ? (
        <p>Capogruppo principale: {primaryGroups.join(", ")}</p>
      ) : null}
      {secondaryGroups.length > 0 ? (
        <p>Capogruppo secondario: {secondaryGroups.join(", ")}</p>
      ) : null}
      {eventLabels.length === 0 && primaryGroups.length === 0 && secondaryGroups.length === 0 ? (
        <p>Responsabilità non indicata</p>
      ) : null}
    </div>
  );
}

function groupNamesForLeaderKind(
  row: OperationalUserRoleRow,
  isPrimary: boolean
): string[] {
  return row.groupLeaderAssignments
    .filter((assignment) => Boolean(assignment.isPrimaryGroupLeader) === isPrimary)
    .map((assignment) => assignment.groupName ?? "Gruppo senza nome");
}

function operationalRowsForGroupEdit(
  rows: OperationalUserRoleRow[]
): GroupEditLeaderRow[] {
  return rows
    .filter((row) => row.assignments.some((assignment) => assignment.role === "capogruppo"))
    .map((row) => ({
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      role: "capogruppo",
      eventId:
        row.groupLeaderAssignments[0]?.eventId ??
        row.eventRoles[0]?.eventId ??
        null,
    }));
}

function filterGroupRows(
  groups: AdminGroupTreeRow[],
  filters: GroupTableFilters
): AdminGroupTreeRow[] {
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
  group: AdminGroupTreeRow,
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
  links: AdminGroupRegistrationLink[]
): Map<string, AdminGroupRegistrationLink[]> {
  const linksByGroupId = new Map<string, AdminGroupRegistrationLink[]>();

  for (const link of links) {
    const groupLinks = linksByGroupId.get(link.groupId) ?? [];
    groupLinks.push(link);
    linksByGroupId.set(link.groupId, groupLinks);
  }

  return linksByGroupId;
}

function getGroupEventOptions(
  groups: AdminGroupTreeRow[]
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

function groupLinkStatusLabel(link: AdminGroupRegistrationLink): string {
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

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function buildGroupLinkUrlFromEncryptedToken(encryptedToken: string | null): string | null {
  const token = decryptQrToken(encryptedToken);

  return token ? buildGroupRegistrationUrl({ appUrl: getAppUrl(), token }) : null;
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
