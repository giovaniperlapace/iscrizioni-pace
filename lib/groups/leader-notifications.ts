import type { SupabaseClient } from "@supabase/supabase-js";

import { renderGroupLeaderAssignmentNotificationEmail } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/smtp";

type AssignmentNotificationRow = {
  id: string;
  registration_id: string;
  group_id: string;
  groups:
    | {
        name: string | null;
        event_id: string;
        events:
          | { title: string | null }
          | Array<{ title: string | null }>
          | null;
      }
    | Array<{
        name: string | null;
        event_id: string;
        events:
          | { title: string | null }
          | Array<{ title: string | null }>
          | null;
      }>
    | null;
  registrations:
    | {
        participants:
          | {
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
            }
          | Array<{
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
            }>
          | null;
      }
    | Array<{
        participants:
          | {
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
            }
          | Array<{
              first_name: string | null;
              last_name: string | null;
              public_code: string | null;
            }>
          | null;
      }>
    | null;
};

type LeaderTargetRow = {
  user_id: string;
};

type LeaderProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export async function notifyGroupLeadersForAssignment(
  supabase: SupabaseClient,
  input: {
    assignmentId: string;
    appUrl: string;
    actorUserId?: string | null;
  }
): Promise<void> {
  const { data: assignment } = await supabase
    .from("participant_group_assignments")
    .select(
      "id,registration_id,group_id,groups!participant_group_assignments_group_id_fkey(name,event_id,events(title)),registrations!inner(participants(first_name,last_name,public_code))"
    )
    .eq("id", input.assignmentId)
    .maybeSingle();
  const assignmentRow = assignment as AssignmentNotificationRow | null;
  const group = relatedOne(assignmentRow?.groups ?? null);
  const registration = relatedOne(assignmentRow?.registrations ?? null);
  const participant = relatedOne(registration?.participants ?? null);

  if (!assignmentRow || !group || !participant) {
    return;
  }

  const eventTitle = relatedOne(group.events)?.title ?? "Evento";
  const groupName = group.name ?? "Gruppo";
  const participantName =
    [participant.first_name, participant.last_name].filter(Boolean).join(" ").trim() ||
    "Partecipante";
  const dashboardLink = `${input.appUrl.replace(/\/$/, "")}/dashboard/capogruppo?filter=to-review`;
  const { data: leaders } = await supabase
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", assignmentRow.group_id)
    .eq("role", "capogruppo");
  const leaderRows = (leaders ?? []) as LeaderTargetRow[];
  const leaderUserIds = [...new Set(leaderRows.map((leader) => leader.user_id))];

  if (leaderUserIds.length === 0) {
    return;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .in("id", leaderUserIds);
  const profilesByUserId = new Map(
    ((profiles ?? []) as LeaderProfileRow[]).map((profile) => [profile.id, profile])
  );

  for (const leader of leaderRows) {
    const profile = profilesByUserId.get(leader.user_id);

    if (!profile?.email) {
      continue;
    }

    try {
      await sendTransactionalEmail({
        to: profile.email,
        ...renderGroupLeaderAssignmentNotificationEmail({
          leaderName: profile.full_name || "Capogruppo",
          participantName,
          participantCode: participant.public_code,
          groupName,
          eventTitle,
          dashboardLink,
        }),
      });
      await supabase.from("audit_logs").insert({
        event_id: group.event_id,
        actor_user_id: input.actorUserId ?? null,
        action: "email.group_leader_assignment_sent",
        entity_table: "participant_group_assignments",
        entity_id: assignmentRow.id,
        metadata: {
          group_id: assignmentRow.group_id,
          leader_user_id: leader.user_id,
          email_domain: getEmailDomain(profile.email),
        },
      });
    } catch (error) {
      await supabase.from("audit_logs").insert({
        event_id: group.event_id,
        actor_user_id: input.actorUserId ?? null,
        action: "email.group_leader_assignment_failed",
        entity_table: "participant_group_assignments",
        entity_id: assignmentRow.id,
        metadata: {
          group_id: assignmentRow.group_id,
          leader_user_id: leader.user_id,
          email_domain: getEmailDomain(profile.email),
          message:
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Errore email sconosciuto",
        },
      });
      console.error("[email:group-leader-assignment]", error);
    }
  }
}

function getEmailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}

function relatedOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}
