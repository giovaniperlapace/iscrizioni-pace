-- Metadata for the minimal group leader dashboard decisions.

alter table public.participant_group_assignments
  add column if not exists leader_internal_note text,
  add column if not exists leader_note_updated_by uuid references auth.users(id) on delete set null,
  add column if not exists leader_note_updated_at timestamptz,
  add column if not exists leader_decision_by uuid references auth.users(id) on delete set null,
  add column if not exists leader_decision_at timestamptz,
  add column if not exists leader_notification_read_at timestamptz;

create index if not exists participant_group_assignments_leader_review_idx
  on public.participant_group_assignments(group_id, is_current, status, leader_notification_read_at);
