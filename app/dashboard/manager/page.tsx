import Link from "next/link";
import {
  BarChart3,
  Network,
  Pencil,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { redirect } from "next/navigation";

import {
  assignOperationalUserRole,
  assignGroupLeader,
  createOperationalTag,
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  saveOperationsGroup,
  updateParticipantOperationalTags,
  updateOperationalUserRole,
} from "@/app/actions";
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
import { getCurrentAuthContext, type EventUserRole } from "@/lib/auth/session";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
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
import type {
  OperationalTagOption,
  ParticipantOperationalTag,
} from "@/lib/registrations/operational-tags";
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
    roleError?: string;
    roleSaved?: string;
    roleUserId?: string;
    roleRole?: string;
    roleEventId?: string;
    roleGroupId?: string;
    edit?: string;
    editMode?: string;
    event?: string;
    group?: string;
    contact?: string;
    tag?: string;
    q?: string;
    nav?: string;
    section?: string;
    stat?: string;
    status?: string;
  }>;
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
  token_encrypted: string | null;
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
  url: string | null;
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
  tagIds: string[];
  tags: ParticipantOperationalTag[];
};

type ManagerOperationsSnapshot = {
  participants: ManagerParticipantRow[];
  allParticipants: ManagerParticipantRow[];
  groupOptions: ManagerGroupOption[];
  groupTree: ManagerGroupTreeRow[];
  groupLinks: ManagerGroupRegistrationLink[];
  operationalTags: OperationalTagOption[];
  roleUsers: OperationalUserRoleRow[];
  filters: OperationsDashboardFilters;
  summary: OperationsDashboardSummary;
};

type ParticipantOperationalTagRow = {
  participant_id: string;
  assigned_at: string | null;
  operational_tags:
    | {
        id: string;
        event_id: string;
        label: string;
        color: string;
      }
    | Array<{
        id: string;
        event_id: string;
        label: string;
        color: string;
      }>
    | null;
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
  day_part: string | null;
  choice: string | null;
};

type ManagerSection = "dashboard" | "iscritti" | "ruoli" | "gruppi";
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
  const currentEvent = await getCurrentOperationalEvent(serviceSupabase, "id,title");
  const currentEventId = currentEvent?.id ?? null;
  const managerOperations = await getManagerOperationsSnapshot(
    serviceSupabase,
    scope,
    filters,
    currentEventId
  );
  const statistics = await getManagerStatisticsSnapshot(
    serviceSupabase,
    scope,
    managerOperations.groupTree,
    currentEventId
  );
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
  const selectedOperationalRole =
    managerOperations.roleUsers.find((role) => role.userId === params.roleUserId) ??
    null;
  const activeSection = resolveManagerSection(params);
  const navMode: ManagerNavMode = params.nav === "mini" ? "mini" : "full";

  return (
    <main className="app-page text-[var(--peace-ink)]">
      <PreserveDashboardScroll />
      <section className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-8 sm:px-8">
        <header className="grid gap-3">
          <h1 className="sr-only">Dashboard manager</h1>
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
              roleError={params.roleError}
              roleSaved={params.roleSaved}
            />

            {activeSection === "dashboard" ? (
              <StatisticsSection
                statistics={statistics}
                basePath="/dashboard/manager"
                navMode={navMode}
                activeLevel={resolveParticipantBreakdownLevel(params.stat)}
              />
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

            {activeSection === "ruoli" ? (
              <ManagerOperationalUsersSection
                roles={managerOperations.roleUsers}
                eventOptions={
                  currentEvent ? [{ id: currentEvent.id, title: currentEvent.title }] : []
                }
                groupOptions={managerOperations.groupTree.filter(
                  (group) => group.isActive && group.isAssignable
                )}
                selectedRole={selectedOperationalRole}
                navMode={navMode}
              />
            ) : null}

            {activeSection === "gruppi" ? (
              <ManagerGroupTreeSection
                groups={managerOperations.groupTree}
                links={managerOperations.groupLinks}
                participants={managerOperations.allParticipants}
                roleUsers={managerOperations.roleUsers}
                currentEventOption={
                  currentEvent ? { id: currentEvent.id, title: currentEvent.title } : null
                }
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
    Icon: typeof BarChart3;
    label: string;
    help: string;
  }> = [
    {
      key: "dashboard",
      href: `/dashboard/manager?section=dashboard&nav=${navMode}`,
      Icon: BarChart3,
      label: "Statistiche",
      help: "Evento e partecipanti",
    },
    {
      key: "iscritti",
      href: `/dashboard/manager?section=iscritti&nav=${navMode}`,
      Icon: Users,
      label: "Gestione iscritti",
      help: "Elenco e modifiche",
    },
    {
      key: "ruoli",
      href: `/dashboard/manager?section=ruoli&nav=${navMode}`,
      Icon: ShieldCheck,
      label: "Gestione ruoli",
      help: "Accessi operativi",
    },
    {
      key: "gruppi",
      href: `/dashboard/manager?section=gruppi&nav=${navMode}`,
      Icon: Network,
      label: "Gestione gruppi",
      help: "Territori, gruppi e link",
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

function managerRoleEditPath(
  role: OperationalUserRoleRow,
  navMode: ManagerNavMode
): string {
  const params = new URLSearchParams({
    section: "ruoli",
    nav: navMode,
    roleUserId: role.userId,
  });

  return `/dashboard/manager?${params.toString()}`;
}

function statisticsPath(
  basePath: "/dashboard/admin" | "/dashboard/manager",
  navMode: ManagerNavMode,
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
  groupMemberships: unknown,
  eventScope: Set<string> | null
): Promise<OperationalUserRoleRow[]> {
  const eventRoleRows = ((eventRoles ?? []) as Array<{
    user_id: string;
    role: string;
    event_id: string | null;
    events: { title: string | null } | Array<{ title: string | null }> | null;
  }>).filter((row) => !eventScope || (row.event_id && eventScope.has(row.event_id)));
  const membershipRows = ((groupMemberships ?? []) as Array<{
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
  }>).filter((row) => {
    const group = relatedOne(row.groups);
    return !eventScope || Boolean(group?.event_id && eventScope.has(group.event_id));
  });
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

function StatisticsSection({
  statistics,
  basePath,
  navMode,
  activeLevel,
}: {
  statistics: EventStatisticsSnapshot;
  basePath: "/dashboard/admin" | "/dashboard/manager";
  navMode: ManagerNavMode;
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
  if (
    params.section === "dashboard" ||
    params.section === "iscritti" ||
    params.section === "ruoli" ||
    params.section === "gruppi"
  ) {
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
    params.roleError ||
    params.roleSaved
  ) {
    return "ruoli";
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

  return "dashboard";
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

async function getManagerOperationsSnapshot(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  scope: ReturnType<typeof getManagerEventScope>,
  filters: OperationsDashboardFilters,
  currentEventId: string | null
): Promise<ManagerOperationsSnapshot> {
  if (
    !currentEventId ||
    (scope.eventIds !== null && !scope.eventIds.has(currentEventId))
  ) {
    return {
      participants: [],
      allParticipants: [],
      groupOptions: [],
      groupTree: [],
      groupLinks: [],
      operationalTags: [],
      roleUsers: [],
      filters,
      summary: summarizeOperationsDashboardParticipants([], []),
    };
  }

  const registrationsQuery = supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,submitted_at,events(title),participants(id,auth_user_id,first_name,last_name,public_code,country_other,city_other)"
    )
    .eq("event_id", currentEventId)
    .order("submitted_at", { ascending: false })
    .limit(200);
  const groupsQuery = supabase
    .from("groups")
    .select("id,event_id,name,is_assignable,is_active")
    .eq("event_id", currentEventId)
    .eq("is_active", true)
    .eq("is_assignable", true)
    .order("name", { ascending: true });

  const groupTreeQuery = supabase
    .from("groups")
    .select(
      "id,event_id,name,public_label,parent_group_id,node_type,community_kind,age_bracket,is_active,is_assignable,is_public_catalog,primary_leader_name,public_order,events(title)"
    )
    .eq("event_id", currentEventId)
    .eq("is_active", true)
    .order("public_order", { ascending: true })
    .order("name", { ascending: true });

  const groupLinksQuery = supabase
    .from("group_registration_links")
    .select(
      "id,event_id,group_id,public_label,internal_label,token_encrypted,use_count,max_uses,created_at,expires_at,revoked_at"
    )
    .eq("event_id", currentEventId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const operationalTagsQuery = supabase
    .from("operational_tags")
    .select("id,event_id,label,color")
    .eq("event_id", currentEventId)
    .order("label", { ascending: true });

  const eventRolesQuery = supabase
    .from("event_user_roles")
    .select("user_id,role,event_id,events(title)")
    .eq("event_id", currentEventId);
  const groupMembershipsQuery = supabase
    .from("group_memberships")
    .select("user_id,role,is_primary,group_id,groups!inner(id,name,event_id,events(title))")
    .eq("groups.event_id", currentEventId);

  const [
    { data: registrations },
    { data: groups },
    { data: groupTree },
    { data: groupLinks },
    { data: operationalTags },
    { data: eventRoles },
    { data: groupMemberships },
  ] = await Promise.all([
    registrationsQuery,
    groupsQuery,
    groupTreeQuery,
    groupLinksQuery,
    operationalTagsQuery,
    eventRolesQuery,
    groupMembershipsQuery,
  ]);
  const registrationRows = (registrations ?? []) as ManagerRegistrationRow[];
  const registrationIds = registrationRows.map((row) => row.id);
  const participantIds = registrationRows.map((row) => row.participant_id);
  const emptyResult = { data: [] };
  const [{ data: contacts }, { data: assignments }, { data: participantTags }] = await Promise.all([
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
    participantIds.length > 0
      ? supabase
          .from("participant_operational_tags")
          .select("participant_id,assigned_at,operational_tags(id,event_id,label,color)")
          .in("participant_id", participantIds)
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
  const tagsByParticipantId = mapParticipantOperationalTags(participantTags);
  const roleUsers = await buildOperationalUserRows(
    supabase,
    eventRoles,
    groupMemberships,
    scope.eventIds
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
        tagIds: (tagsByParticipantId.get(registration.participant_id) ?? []).map(
          (tag) => tag.id
        ),
        tags: tagsByParticipantId.get(registration.participant_id) ?? [],
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
        url: buildGroupLinkUrlFromEncryptedToken(link.token_encrypted),
        useCount: link.use_count ?? 0,
        maxUses: link.max_uses,
        createdAt: link.created_at,
        expiresAt: link.expires_at,
        revokedAt: link.revoked_at,
      })
    ),
    operationalTags: ((operationalTags ?? []) as Array<{
      id: string;
      event_id: string;
      label: string;
      color: string;
    }>).map((tag) => ({
      id: tag.id,
      eventId: tag.event_id,
      label: tag.label,
      color: tag.color,
    })),
    roleUsers,
    filters,
    summary: summarizeOperationsDashboardParticipants(
      participantRows,
      filteredParticipants
    ),
  };
}

async function getManagerStatisticsSnapshot(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  scope: ReturnType<typeof getManagerEventScope>,
  groupTree: ManagerGroupTreeRow[],
  currentEventId: string | null
): Promise<EventStatisticsSnapshot> {
  if (
    !currentEventId ||
    (scope.eventIds !== null && !scope.eventIds.has(currentEventId))
  ) {
    return buildEventStatisticsSnapshot({
      participants: [],
      groups: [],
      attendanceChoices: [],
    });
  }

  const registrationsQuery = supabase
    .from("registrations")
    .select(
      "id,event_id,participant_id,status,submitted_at,events(title),participants(id,auth_user_id,first_name,last_name,public_code,country_other,city_other)"
    )
    .eq("event_id", currentEventId)
    .order("submitted_at", { ascending: false })
    .range(0, 9999);

  const { data: registrations } = await registrationsQuery;
  const registrationRows = (registrations ?? []) as ManagerRegistrationRow[];
  const registrationIds = registrationRows.map((row) => row.id);
  const [{ data: assignments }, { data: attendanceChoices }] = await Promise.all([
    registrationIds.length > 0
      ? supabase
          .from("participant_group_assignments")
          .select(
            "registration_id,group_id,status,groups!participant_group_assignments_group_id_fkey(name)"
          )
          .in("registration_id", registrationIds)
          .eq("is_current", true)
      : Promise.resolve({ data: [] }),
    registrationIds.length > 0
      ? supabase
          .from("event_attendance_choices")
          .select("registration_id,day,day_part,choice")
          .in("registration_id", registrationIds)
      : Promise.resolve({ data: [] }),
  ]);
  const assignmentByRegistrationId = new Map(
    ((assignments ?? []) as ManagerCurrentAssignmentRow[]).map((row) => [
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
      tagIds: [],
      tags: [],
    };
  });

  return buildEventStatisticsSnapshot({
    participants,
    groups: groupTree,
    attendanceChoices: (attendanceChoices ?? []) as AttendanceChoiceRow[],
  });
}

function ManagerGroupTreeSection({
  groups,
  links,
  participants,
  roleUsers,
  currentEventOption,
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
  roleUsers: OperationalUserRoleRow[];
  currentEventOption: { id: string; title: string } | null;
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
  const eventOptions = currentEventOption
    ? [currentEventOption]
    : getGroupEventOptions(groups);

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
            scroll={false}
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]"
          >
            Nuovo gruppo
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <EventValue label="Gruppi visibili" value={filteredGroups.length} />
        <EventValue label="Iscrivibili" value={filteredGroups.filter((group) => group.isAssignable).length} />
        <EventValue label="Nel form pubblico" value={filteredGroups.filter((group) => group.isPublicCatalog).length} />
        <EventValue label="Link attivi" value={links.length} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <AutoFilterForm
          action="/dashboard/manager"
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
                  <label className="sr-only" htmlFor="manager-group-q">Cerca gruppo</label>
                  <input
                    id="manager-group-q"
                    name="groupQ"
                    defaultValue={filters.q}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Nome, referente, label"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="manager-group-type">Tipo nodo</label>
                  <select
                    id="manager-group-type"
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
                  <label className="sr-only" htmlFor="manager-group-visibility">Accesso iscrizione</label>
                  <select
                    id="manager-group-visibility"
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
                        href={managerPath("gruppi", navMode)}
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
              const canManage = canManageEvent(group.eventId);

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
                      {canManage ? (
                        <Link
                          href={`${managerPath("gruppi", navMode)}&groupTool=edit&groupId=${group.id}`}
                          scroll={false}
                          className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                        >
                          Modifica
                        </Link>
                      ) : null}
                      <Link
                        href={`${managerPath("gruppi", navMode)}&groupTool=links&groupId=${group.id}`}
                        scroll={false}
                        className="inline-flex min-h-9 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-xs font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
                      >
                        Gestisci link
                      </Link>
                      {canManage ? (
                        <Link
                          href={`${managerPath("gruppi", navMode)}&groupTool=leaders&groupId=${group.id}`}
                          scroll={false}
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
        </AutoFilterForm>
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
          leaders={roleUsers}
          navMode={navMode}
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

function ManagerGroupEditOverlay({
  group,
  groups,
  eventOptions,
  leaders,
  navMode,
}: {
  group: ManagerGroupTreeRow | null;
  groups: ManagerGroupTreeRow[];
  eventOptions: Array<{ id: string; title: string }>;
  leaders: OperationalUserRoleRow[];
  navMode: ManagerNavMode;
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
          <input type="hidden" name="sourceDashboard" value="manager" />
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
            <Link href={managerPath("gruppi", navMode)} scroll={false} className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
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
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Link gruppo</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
          </div>
          <Link
            href={managerPath("gruppi", navMode)}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label="Chiudi modale link gruppo"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          <AutoCopyLinkNotice url={createdUrl} />

          {canManage ? (
            <form action={createGroupRegistrationLink} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4" data-preserve-dashboard-scroll>
              <input type="hidden" name="sourceDashboard" value="manager" />
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
          ) : (
            <p className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
              Consultazione senza permessi di modifica.
            </p>
          )}

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
                  {canManage ? (
                    <form action={revokeGroupRegistrationLink} data-preserve-dashboard-scroll>
                      <input type="hidden" name="sourceDashboard" value="manager" />
                      <input type="hidden" name="linkId" value={link.id} />
                      <PendingSubmitButton className="min-h-9 rounded-md border border-[#d1a7a0] px-3 text-xs font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]">
                        Revoca
                      </PendingSubmitButton>
                    </form>
                  ) : null}
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
    <div className="dashboard-modal fixed inset-0 z-40 grid place-items-center bg-black/35 px-4 py-6">
      <div className="grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--peace-border)] px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Assegna capogruppo</h3>
            <p className="mt-1 text-sm text-[var(--peace-muted)]">{group.name}</p>
          </div>
          <Link
            href={managerPath("gruppi", navMode)}
            scroll={false}
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--peace-border-strong)] text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
            aria-label="Chiudi modale capogruppo"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          {canManage ? (
            <GroupLeaderModeTabs
              existingForm={
              <form action={assignGroupLeader} className="grid gap-3 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4" data-preserve-dashboard-scroll>
                  <input type="hidden" name="sourceDashboard" value="manager" />
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
                  <GroupLeaderKindField />
                  <PendingSubmitButton className="min-h-10 rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]">
                    Crea utente e assegna
                  </PendingSubmitButton>
                </form>
              }
            />
          ) : (
            <p className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 text-sm text-[var(--peace-muted)]">
              Consultazione senza permessi di modifica.
            </p>
          )}
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
  const currentGroupOptions = getCurrentGroupFilterOptions(snapshot.allParticipants);
  const activeEventId = snapshot.allParticipants[0]?.eventId ?? snapshot.operationalTags[0]?.eventId ?? null;

  return (
    <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gestione iscritti</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
            Ultime iscrizioni visibili al manager, fino a 200 risultati recenti.
          </p>
        </div>
        {activeEventId ? (
          <form
            action={createOperationalTag}
            className="grid gap-2 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-3 sm:grid-cols-[1fr_auto_auto]"
          >
            <input type="hidden" name="eventId" value={activeEventId} />
            <input type="hidden" name="nav" value={navMode} />
            <label className="sr-only" htmlFor="new-operational-tag">
              Nuovo tag operativo
            </label>
            <input
              id="new-operational-tag"
              name="label"
              className="field min-h-10 bg-white text-sm font-normal"
              maxLength={40}
              placeholder="Nuovo tag"
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
          action="/dashboard/manager"
          defaults={{ q: "", contact: "", group: "all", tag: "all", status: "all" }}
        >
          <input type="hidden" name="section" value="iscritti" />
          <input type="hidden" name="nav" value={navMode} />
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
                <th className="py-3 pr-4 font-semibold">Iscrizione</th>
                <th className="py-3 pr-4 font-semibold">Contatti</th>
                <th className="py-3 pr-4 font-semibold">Gruppo</th>
                <th className="py-3 pr-4 font-semibold">Tag</th>
                <th className="py-3 text-right font-semibold">Azioni</th>
              </tr>
              <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] align-top">
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="manager-participant-q">Cerca iscrizione</label>
                  <input
                    id="manager-participant-q"
                    name="q"
                    defaultValue={snapshot.filters.q}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Nome, codice, email"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="manager-participant-contact">Cerca contatto</label>
                  <input
                    id="manager-participant-contact"
                    name="contact"
                    defaultValue={snapshot.filters.contact}
                    className="field min-h-10 bg-white text-sm font-normal"
                    placeholder="Email, telefono"
                  />
                </th>
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="manager-participant-group">Gruppo</label>
                  <select
                    id="manager-participant-group"
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
                <th className="py-3 pr-4">
                  <label className="sr-only" htmlFor="manager-participant-tag">Tag</label>
                  <select
                    id="manager-participant-tag"
                    name="tag"
                    defaultValue={snapshot.filters.tag}
                    className="field min-h-10 bg-white text-sm font-normal"
                  >
                    <option value="all">Tutti i tag</option>
                    <option value="none">Senza tag</option>
                    {snapshot.operationalTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <label className="sr-only" htmlFor="manager-participant-status">Stato</label>
                    <select
                      id="manager-participant-status"
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
                        href={managerPath("iscritti", navMode)}
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
                    <td className="py-4 pr-4">
                      <OperationalTagList tags={participant.tags} emptyLabel="Senza tag" />
                    </td>
                    <td className="py-4 text-right">
                      {canManage ? (
                        <Link
                          href={`${managerPath("iscritti", navMode)}&edit=${participant.registrationId}`}
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
        <ManagerParticipantEditOverlay
          participant={selectedParticipant}
          groupOptions={snapshot.groupOptions.filter(
            (group) => group.eventId === selectedParticipant.eventId
          )}
          tagOptions={snapshot.operationalTags.filter(
            (tag) => tag.eventId === selectedParticipant.eventId
          )}
          isEditing={isEditingParticipant}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function ManagerOperationalUsersSection({
  roles,
  eventOptions,
  groupOptions,
  selectedRole,
  navMode,
}: {
  roles: OperationalUserRoleRow[];
  eventOptions: Array<{ id: string; title: string }>;
  groupOptions: ManagerGroupTreeRow[];
  selectedRole: OperationalUserRoleRow | null;
  navMode: ManagerNavMode;
}) {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h2 className="text-lg font-semibold">Utenti e ruoli</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--peace-muted)]">
          Crea accessi operativi per gli eventi assegnati senza creare una
          iscrizione. Manager, viewer e accoglienza accedono direttamente alla
          dashboard operativa; solo il capogruppo completa anche
          l&apos;iscrizione personale.
        </p>
        <form action={assignOperationalUserRole} className="mt-5 grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
          <input type="hidden" name="sourceDashboard" value="manager" />
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
                        href={managerRoleEditPath(row, navMode)}
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
        <ManagerOperationalRoleEditOverlay
          role={selectedRole}
          eventOptions={eventOptions}
          groupOptions={groupOptions}
          navMode={navMode}
        />
      ) : null}
    </section>
  );
}

function ManagerOperationalRoleEditOverlay({
  role,
  eventOptions,
  groupOptions,
  navMode,
}: {
  role: OperationalUserRoleRow;
  eventOptions: Array<{ id: string; title: string }>;
  groupOptions: ManagerGroupTreeRow[];
  navMode: ManagerNavMode;
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
            href={`/dashboard/manager?section=ruoli&nav=${navMode}`}
            scroll={false}
            aria-label="Chiudi"
            className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--peace-border)] text-[var(--peace-muted)] transition hover:bg-[var(--peace-sky-100)]"
          >
            <X className="size-5" aria-hidden="true" />
          </Link>
        </div>

        <form action={updateOperationalUserRole} className="mt-5 grid gap-4" data-preserve-dashboard-scroll>
          <input type="hidden" name="sourceDashboard" value="manager" />
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
              href={`/dashboard/manager?section=ruoli&nav=${navMode}`}
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

function ManagerParticipantEditOverlay({
  participant,
  groupOptions,
  tagOptions,
  isEditing,
  navMode,
}: {
  participant: ManagerParticipantRow;
  groupOptions: ManagerGroupOption[];
  tagOptions: OperationalTagOption[];
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
          <div className="grid gap-2 text-sm">
            <span className="font-semibold text-[var(--peace-ink)]">Tag operativi</span>
            <OperationalTagList tags={participant.tags} emptyLabel="Senza tag" />
          </div>

          {isEditing ? (
            <div className="grid gap-5">
              <form
                action="/dashboard/admin/participants/update"
                method="post"
                className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
                data-preserve-dashboard-scroll
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
                <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                  Salva gruppo
                </PendingSubmitButton>
              </form>
              <form
                action={updateParticipantOperationalTags}
                className="grid gap-4 rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4"
                data-preserve-dashboard-scroll
              >
                <input type="hidden" name="sourceDashboard" value="manager" />
                <input type="hidden" name="nav" value={navMode} />
                <input type="hidden" name="registrationId" value={participant.registrationId} />
                <input type="hidden" name="participantId" value={participant.participantId} />
                <input type="hidden" name="eventId" value={participant.eventId} />
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-semibold text-[var(--peace-ink)]">
                    Tag operativi
                  </legend>
                  <TagCheckboxGrid
                    tagOptions={tagOptions}
                    selectedTagIds={participant.tagIds}
                    emptyLabel="Nessun tag creato per questo evento."
                  />
                </fieldset>
                <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)]">
                  Salva tag
                </PendingSubmitButton>
              </form>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--peace-border)] px-5 py-4">
          <Link
            href={managerPath("iscritti", navMode)}
            scroll={false}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-[var(--peace-sky-100)]"
          >
            Chiudi
          </Link>
          {!isEditing ? (
            <Link
              href={`${managerPath("iscritti", navMode)}&edit=${participant.registrationId}&editMode=1`}
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

function StatusMessage({
  error,
  saved,
  managerError,
  managerSaved,
  groupLinkError,
  groupLinkSaved,
  groupError,
  groupSaved,
  roleError,
  roleSaved,
}: {
  error?: string;
  saved?: string;
  managerError?: string;
  managerSaved?: string;
  groupLinkError?: string;
  groupLinkSaved?: string;
  groupError?: string;
  groupSaved?: string;
  roleError?: string;
  roleSaved?: string;
}) {
  if (saved || managerSaved || groupLinkSaved || groupSaved || roleSaved) {
    return (
      <p className="rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        {groupSaved
          ? "Gruppo aggiornato."
          : groupLinkSaved
          ? "Link gruppo aggiornato."
          : roleSaved
            ? "Utente operativo aggiornato."
          : managerSaved
            ? "Gestione iscritti aggiornata."
            : "Configurazione apertura aggiornata."}
      </p>
    );
  }

  if (!error && !managerError && !groupLinkError && !groupError && !roleError) {
    return null;
  }

  const messages: Record<string, string> = {
    invalid: "Comando apertura non valido.",
    "not-found": "Evento non trovato.",
    forbidden: "Non hai permessi di modifica su questo evento.",
    "invalid-group": "Gruppo non valido per questa iscrizione.",
    "invalid-parent": "Il gruppo parent non è valido per questo evento.",
    "missing-event": "Seleziona un evento per questo ruolo.",
    "missing-group": "Seleziona un gruppo per il ruolo capogruppo.",
    "auth-user": "Non è stato possibile creare o recuperare l'utente.",
    "email-taken": "Questa email è già associata a un altro utente operativo.",
    "invite-email": "Ruolo assegnato, ma non è stato possibile inviare l'email di invito.",
    "self-role": "Non puoi revocare o spostare il ruolo con cui stai operando.",
    "duplicate-tag": "Esiste già un tag con questo nome per l'evento corrente.",
  };
  const messageKey = groupError ?? groupLinkError ?? roleError ?? managerError ?? error;

  return (
    <p className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {messageKey
        ? messages[messageKey] ?? "Non è stato possibile completare l'operazione."
        : "Non è stato possibile completare l'operazione."}
    </p>
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

function OperationalTagList({
  tags,
  emptyLabel,
}: {
  tags: ParticipantOperationalTag[];
  emptyLabel: string;
}) {
  if (tags.length === 0) {
    return <span className="text-sm text-[var(--peace-muted)]">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--peace-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--peace-ink)]"
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.label}
        </span>
      ))}
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
        <label
          key={tag.id}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--peace-border)] bg-white px-3 text-sm font-semibold text-[var(--peace-ink)]"
        >
          <input
            type="checkbox"
            name="tagIds"
            value={tag.id}
            defaultChecked={selected.has(tag.id)}
            className="size-4 accent-[var(--peace-blue-800)]"
          />
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.label}
        </label>
      ))}
    </div>
  );
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

function mapParticipantOperationalTags(
  rows: unknown
): Map<string, ParticipantOperationalTag[]> {
  const tagsByParticipantId = new Map<string, ParticipantOperationalTag[]>();

  for (const row of (rows ?? []) as ParticipantOperationalTagRow[]) {
    const tag = relatedOne(row.operational_tags);

    if (!tag) {
      continue;
    }

    const participantTags = tagsByParticipantId.get(row.participant_id) ?? [];
    participantTags.push({
      id: tag.id,
      eventId: tag.event_id,
      label: tag.label,
      color: tag.color,
      assignedAt: row.assigned_at,
    });
    tagsByParticipantId.set(row.participant_id, participantTags);
  }

  return tagsByParticipantId;
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
  participants: ManagerParticipantRow[]
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

function buildGroupLinkUrlFromEncryptedToken(encryptedToken: string | null): string | null {
  const token = decryptQrToken(encryptedToken);

  return token ? buildGroupRegistrationUrl({ appUrl: getAppUrl(), token }) : null;
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
