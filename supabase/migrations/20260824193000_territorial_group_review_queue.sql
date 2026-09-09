-- Route registrations without any group assignment to the closest territorial
-- review node. Explicit group choices keep their own current assignment; this
-- backfill only covers registrations that have never had an assignment.

with ranked_candidates as (
  select
    registrations.id as registration_id,
    registrations.event_id,
    groups.id as group_id,
    row_number() over (
      partition by registrations.id
      order by
        (groups.city_id is not null and groups.city_id = participants.city_id) desc,
        case groups.node_type when 'city' then 2 when 'country' then 1 else 0 end desc,
        groups.public_order,
        groups.name
    ) as candidate_rank
  from public.registrations registrations
  join public.participants participants
    on participants.id = registrations.participant_id
  join public.groups groups
    on groups.event_id = registrations.event_id
   and groups.is_active
   and groups.community_kind = 'territorial'
   and groups.node_type in ('city', 'country')
   and (
     (
       participants.city_id is not null
       and groups.city_id = participants.city_id
     )
     or (
       groups.city_id is null
       and participants.country_id is not null
       and groups.country_id = participants.country_id
     )
   )
  where registrations.status <> 'cancelled'
    and not exists (
      select 1
      from public.participant_group_assignments assignments
      where assignments.registration_id = registrations.id
    )
),
inserted_assignments as (
  insert into public.participant_group_assignments (
    registration_id,
    group_id,
    status,
    source,
    confidence,
    is_current,
    assignment_reason,
    escalation_depth,
    matcher_version,
    leader_notification_read_at
  )
  select
    registration_id,
    group_id,
    'probable',
    'rule',
    0.5,
    true,
    'territorial_review_queue',
    0,
    '2026-08-24-territorial-review-v4',
    null
  from ranked_candidates
  where candidate_rank = 1
  on conflict (registration_id, group_id) do nothing
  returning id, registration_id, group_id
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
  'participant.territorial_review_backfilled',
  'participant_group_assignments',
  inserted_assignments.id,
  jsonb_build_object(
    'registration_id', inserted_assignments.registration_id,
    'group_id', inserted_assignments.group_id,
    'assignment_reason', 'territorial_review_queue'
  )
from inserted_assignments
join public.registrations registrations
  on registrations.id = inserted_assignments.registration_id;

notify pgrst, 'reload schema';
