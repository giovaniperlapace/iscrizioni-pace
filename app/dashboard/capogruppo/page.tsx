import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createGroupRegistrationLink,
  revokeGroupRegistrationLink,
  updateGroupLeaderAssignment,
} from "@/app/actions";
import {
  DashboardAreaDescription,
  DashboardRoleTabs,
} from "@/app/dashboard/role-tabs";
import { getCurrentAuthContext } from "@/lib/auth/session";
import {
  collectDescendantGroupIds,
  matchesGroupLeaderFilter,
  parseGroupLeaderReviewFilter,
  summarizeGroupLeaderAssignments,
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
  public_label: string | null;
  primary_leader_name: string | null;
  events:
    | { title: string | null }
    | Array<{ title: string | null }>
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
  isAssignable: boolean;
  isPublicCatalog: boolean;
  publicLabel: string | null;
  primaryLeaderName: string | null;
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
              country_name: string | null;
              city_name: string | null;
              participates_with_group: boolean | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_name: string | null;
              city_name: string | null;
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
              country_name: string | null;
              city_name: string | null;
              participates_with_group: boolean | null;
            }
          | Array<{
              id: string;
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
              birth_date: string | null;
              country_name: string | null;
              city_name: string | null;
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

const FILTER_LABELS: Record<GroupLeaderReviewFilter, string> = {
  all: "Tutti",
  "to-review": "Da verificare",
  probable: "Probabili",
  confirmed: "Confermati",
  rejected: "Rifiutati",
};

export default async function CapogruppoDashboardPage({
  searchParams,
}: CapogruppoPageProps) {
  const params = await searchParams;
  const filter = parseGroupLeaderReviewFilter(params.filter);
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
      "id,event_id,name,parent_group_id,node_type,is_assignable,is_public_catalog,public_label,primary_leader_name,events(title)"
    )
    .eq("is_active", true);
  const groupRows = (groups ?? []) as GroupRow[];
  const groupNodes = groupRows.map<GroupTreeNode>((group) => ({
    id: group.id,
    parentGroupId: group.parent_group_id,
  }));
  const scopedGroupIds = collectDescendantGroupIds(groupNodes, rootGroupIds);

  const assignments = await getAssignments([...scopedGroupIds]);
  const scopedGroups = groupRows
    .filter((group) => scopedGroupIds.has(group.id))
    .map<ScopedGroupView>((group) => ({
      id: group.id,
      eventId: group.event_id,
      eventTitle: relatedOne(group.events)?.title ?? "Evento",
      name: group.name ?? "Gruppo senza nome",
      isAssignable: group.is_assignable ?? true,
      isPublicCatalog: group.is_public_catalog ?? true,
      publicLabel: group.public_label,
      primaryLeaderName: group.primary_leader_name,
    }));
  const groupLinks = await getGroupLinks([...scopedGroupIds]);
  const summary = summarizeGroupLeaderAssignments(assignments);
  const filteredAssignments = assignments.filter((assignment) =>
    matchesGroupLeaderFilter(assignment, filter)
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
          saved={params.saved ?? params.groupLinkSaved}
        />

        <section className="grid gap-4 sm:grid-cols-4">
          <Metric label="Nodi assegnati" value={String(rootGroupIds.length)} />
          <Metric label="Partecipanti visibili" value={String(summary.total)} />
          <Metric label="Da verificare" value={String(summary.toReview)} />
          <Metric label="Confermati" value={String(summary.confirmed)} />
        </section>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assegnazioni gruppo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
                Le decisioni sono interne e non inviano comunicazioni al
                partecipante. Il rifiuto passa al nodo superiore, oppure alla
                coda manager se non esiste un padre.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FILTER_LABELS).map(([key, label]) => (
                <Link
                  key={key}
                  href={`/dashboard/capogruppo?filter=${key}`}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    filter === key
                      ? "border-[#315c44] bg-[#315c44] text-white"
                      : "border-[#c8d5be] text-[#38563d] hover:bg-[#eef2e7]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SmallMetric label="Probabili" value={summary.probable} />
            <SmallMetric label="Rifiutati" value={summary.rejected} />
            <SmallMetric label="Nodi in scope" value={scopedGroupIds.size} />
            <SmallMetric label="Vista" value={filteredAssignments.length} />
          </div>
        </section>

        <GroupLeaderLinksSection
          groups={scopedGroups}
          links={groupLinks}
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

        <section className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}

          {filteredAssignments.length === 0 ? (
            <div className="rounded-lg border border-[#d8dece] bg-white p-5 text-sm text-[#5e6d63]">
              Nessuna assegnazione in questa vista.
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );

  async function getAssignments(groupIds: string[]): Promise<AssignmentView[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const { data } = await serviceSupabase
      .from("participant_group_assignments")
      .select(
        "id,registration_id,group_id,status,source,confidence,is_current,assignment_reason,escalation_depth,leader_internal_note,leader_notification_read_at,leader_decision_at,created_at,updated_at,groups(id,name,node_type,parent_group_id),registrations(id,event_id,status,submitted_at,participants(id,first_name,last_name,public_code,birth_date,country_name,city_name,participates_with_group))"
      )
      .in("group_id", groupIds)
      .order("updated_at", { ascending: false })
      .limit(100);

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

function GroupLeaderLinksSection({
  groups,
  links,
  createdGroupId,
  createdUrl,
}: {
  groups: ScopedGroupView[];
  links: GroupLinkView[];
  createdGroupId: string | null;
  createdUrl: string | null;
}) {
  const assignableGroups = groups.filter((group) => group.isAssignable);
  const linksByGroupId = new Map<string, GroupLinkView[]>();

  for (const link of links) {
    const groupLinks = linksByGroupId.get(link.groupId) ?? [];
    groupLinks.push(link);
    linksByGroupId.set(link.groupId, groupLinks);
  }

  return (
    <section className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold">Link iscrizione gruppo</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5e6d63]">
          Puoi generare link riservati solo per i gruppi nel tuo scope. I link
          non rendono il gruppo visibile nel menu pubblico.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        {assignableGroups.map((group) => {
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
                    Label pubblica:{" "}
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
                    Label pubblica
                    <input
                      name="publicLabel"
                      className="field"
                      defaultValue={group.publicLabel ?? ""}
                      placeholder="Gruppo indicato dal referente"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-[#3c4b40]">
                    Etichetta interna
                    <input
                      name="internalLabel"
                      className="field"
                      placeholder="Per riconoscere questo invito"
                    />
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
          Nessun gruppo iscrivibile nel tuo scope.
        </p>
      ) : null}
    </section>
  );
}

function AssignmentCard({ assignment }: { assignment: AssignmentView }) {
  const canDecide = assignment.isCurrent && assignment.status === "probable";

  return (
    <article className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{assignment.participantName}</h3>
            {assignment.participantCode ? (
              <span className="rounded-full border border-[#d7dece] px-2.5 py-1 text-xs font-semibold text-[#516356]">
                {assignment.participantCode}
              </span>
            ) : null}
            <StatusBadge status={assignment.status} isCurrent={assignment.isCurrent} />
            {!assignment.leaderNotificationReadAt && canDecide ? (
              <span className="rounded-full bg-[#fff1c2] px-2.5 py-1 text-xs font-semibold text-[#6b5214]">
                Da verificare
              </span>
            ) : null}
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Gruppo" value={assignment.groupName} />
            <Info label="Provenienza" value={assignment.participantPlace} />
            <Info label="Iscrizione" value={formatDateTime(assignment.submittedAt)} />
            <Info label="Origine" value={sourceLabel(assignment.source)} />
            <Info label="Confidenza" value={formatConfidence(assignment.confidence)} />
            <Info label="Aggiornata" value={formatDateTime(assignment.updatedAt)} />
          </dl>

          {assignment.assignmentReason ? (
            <p className="mt-4 text-sm text-[#5e6d63]">
              Motivo interno: {assignmentReasonLabel(assignment.assignmentReason)}
            </p>
          ) : null}
          {assignment.leaderInternalNote ? (
            <p className="mt-3 rounded-md bg-[#f4f6ef] p-3 text-sm leading-6 text-[#4b5a50]">
              Nota interna: {assignment.leaderInternalNote}
            </p>
          ) : null}
        </div>

        <form action={updateGroupLeaderAssignment} className="grid gap-3">
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <label className="grid gap-2 text-sm font-semibold text-[#3c4b40]">
            Nota interna
            <textarea
              name="leaderInternalNote"
              defaultValue={assignment.leaderInternalNote ?? ""}
              rows={4}
              className="min-h-24 rounded-md border border-[#cfd8c4] bg-white px-3 py-2 text-sm font-normal text-[#1c241f] outline-none transition focus:border-[#56745d]"
            />
          </label>
          <div className="grid gap-2">
            <button
              name="intent"
              value="note"
              className="min-h-10 rounded-md border border-[#b8c5ad] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
            >
              Salva nota
            </button>
            {canDecide ? (
              <>
                <button
                  name="intent"
                  value="confirm"
                  className="min-h-10 rounded-md bg-[#315c44] px-3 text-sm font-semibold text-white transition hover:bg-[#264a36]"
                >
                  Conferma appartenenza
                </button>
                <button
                  name="intent"
                  value="reject"
                  className="min-h-10 rounded-md border border-[#d1a7a0] px-3 text-sm font-semibold text-[#8a3f35] transition hover:bg-[#fff0ee]"
                >
                  Non riconosciuto
                </button>
                <button
                  name="intent"
                  value="read"
                  className="min-h-10 rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#516356] transition hover:bg-[#eef2e7]"
                >
                  Segna letta
                </button>
              </>
            ) : null}
          </div>
        </form>
      </div>
    </article>
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

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#e0e5d8] bg-[#fafbf7] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6a766d]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#718075]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[#27332b]">{value}</dd>
    </div>
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
    participantPlace: formatPlace(participant.city_name, participant.country_name),
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

function formatConfidence(confidence: number | null): string {
  if (confidence === null) {
    return "Non indicata";
  }

  return `${Math.round(confidence * 100)}%`;
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
