-- Do not keep probable assignments created only because a participant did not
-- select (or could not find) a Sant'Egidio group. Confirmed assignments remain
-- untouched because a group leader has already validated them.

with affected_assignments as (
  update public.participant_group_assignments assignments
  set
    is_current = false,
    status = 'rejected',
    leader_decision_at = coalesce(assignments.leader_decision_at, now()),
    leader_notification_read_at = coalesce(
      assignments.leader_notification_read_at,
      now()
    ),
    updated_at = now()
  from public.registrations registrations
  where registrations.id = assignments.registration_id
    and assignments.is_current
    and assignments.status = 'probable'
    and assignments.source = 'rule'
    and assignments.assignment_reason in (
      'santegidio_territorial_fallback',
      'participant_cannot_find_leader'
    )
  returning
    assignments.id,
    assignments.registration_id,
    assignments.group_id,
    assignments.assignment_reason
)
insert into public.audit_logs (
  event_id,
  action,
  entity_table,
  entity_id,
  metadata
)
select
  registrations.event_id,
  'participant.group_auto_assignment_removed',
  'participant_group_assignments',
  affected_assignments.id,
  jsonb_build_object(
    'registration_id', affected_assignments.registration_id,
    'group_id', affected_assignments.group_id,
    'previous_assignment_reason', affected_assignments.assignment_reason,
    'reason', 'group_not_explicitly_selected'
  )
from affected_assignments
join public.registrations registrations
  on registrations.id = affected_assignments.registration_id;

notify pgrst, 'reload schema';
