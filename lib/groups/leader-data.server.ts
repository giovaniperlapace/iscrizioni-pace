import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import { collectDescendantGroupIds } from "./capogruppo-dashboard.ts";
import type { AssignmentRow } from "./leader-assignments.ts";
export type GroupRow = {
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
    | Array<{
        title: string | null;
        starts_on: string | null;
        ends_on: string | null;
      }>
    | null;
};

// The caller verifies the authenticated dashboard role first. No URL can select
// a user or event here: both come from the authenticated server context.
export async function loadLeaderScope(
  db: SupabaseClient,
  userId: string,
  eventId: string,
) {
  const [memberships, groups] = await Promise.all([
    loadAllRows((from, to) =>
      db
        .from("group_memberships")
        .select("group_id")
        .eq("user_id", userId)
        .eq("role", "capogruppo")
        .order("id")
        .range(from, to),
    ),
    loadAllRows((from, to) =>
      db
        .from("groups")
        .select(
          "id,event_id,name,parent_group_id,node_type,is_assignable,is_public_catalog,is_active,public_label,primary_leader_name,events(title,starts_on,ends_on)",
        )
        .eq("event_id", eventId)
        .order("id")
        .range(from, to),
    ),
  ]);
  const groupRows = groups.data as unknown as GroupRow[];
  const currentIds = new Set(groupRows.map((group) => group.id));
  const rootGroupIds = memberships.data
    .map((row) => row.group_id as string)
    .filter((id) => currentIds.has(id));
  const activeGroupRows = groupRows.filter((group) => group.is_active ?? true);
  const scopedGroupIds = collectDescendantGroupIds(
    activeGroupRows.map((group) => ({
      id: group.id,
      parentGroupId: group.parent_group_id,
    })),
    rootGroupIds,
  );
  return { groupRows, activeGroupRows, rootGroupIds, scopedGroupIds };
}
export async function loadLeaderAssignmentRows(
  db: SupabaseClient,
  eventId: string,
  groupIds: string[],
): Promise<AssignmentRow[]> {
  const { data } = await loadRowsForIds(groupIds, (ids, from, to) =>
    db
      .from("participant_group_assignments")
      .select(
        "id,registration_id,group_id,status,source,confidence,is_current,assignment_reason,escalation_depth,leader_internal_note,leader_decision_at,created_at,updated_at,groups!participant_group_assignments_group_id_fkey(id,name,node_type,parent_group_id,is_assignable),registrations!inner(id,event_id,status,submitted_at,registration_children(id,first_name,last_name,birth_date,position),participants(id,first_name,last_name,public_code,birth_date,country_other,city_other,participant_contacts(email,phone,is_primary),countries(name_it),cities(name),participates_with_group,participant_event_services(id,event_id,registration_id,participant_id,service_id,status,source,participant_note,operator_note,updated_at,event_services(label)),participant_operational_tags(assigned_at,operational_tags(id,event_id,label,color))))",
      )
      .in("group_id", ids)
      .eq("registrations.event_id", eventId)
      .is("registrations.deleted_at", null)
      .eq("is_current", true)
      .order("id")
      .range(from, to),
  );
  return data as unknown as AssignmentRow[];
}
