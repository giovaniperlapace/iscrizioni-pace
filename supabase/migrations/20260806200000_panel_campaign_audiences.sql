-- Milestone P9: panel-aware participant campaigns and a distinct teacher audience.

alter table public.email_campaign_recipients
  drop constraint if exists email_campaign_recipients_target_check,
  drop constraint if exists email_campaign_recipients_recipient_type_check,
  drop constraint if exists email_campaign_recipients_delivery_kind_check;

alter table public.email_campaign_recipients
  add column school_teacher_id uuid
    references public.school_booking_teachers(id) on delete restrict,
  add constraint email_campaign_recipients_recipient_type_check
    check (recipient_type in ('participant', 'group_leader', 'teacher')),
  add constraint email_campaign_recipients_delivery_kind_check
    check (delivery_kind in ('direct', 'delegated', 'leader', 'teacher')),
  add constraint email_campaign_recipients_target_check
    check (
      (
        recipient_type = 'participant'
        and participant_id is not null
        and registration_id is not null
        and recipient_user_id is null
        and school_teacher_id is null
        and delivery_kind in ('direct', 'delegated')
      )
      or
      (
        recipient_type = 'group_leader'
        and registration_id is null
        and school_teacher_id is null
        and delivery_kind = 'leader'
      )
      or
      (
        recipient_type = 'teacher'
        and participant_id is null
        and registration_id is null
        and recipient_user_id is null
        and delegate_user_id is null
        and school_teacher_id is not null
        and delivery_kind = 'teacher'
      )
    );

create index email_campaign_recipients_school_teacher_idx
  on public.email_campaign_recipients(school_teacher_id)
  where school_teacher_id is not null;

comment on column public.email_campaign_recipients.recipient_key is
  'Chiave congelata: participant:<uuid>, leader:<auth-user-uuid> oppure teacher:<school-teacher-uuid>.';

comment on column public.email_campaign_recipients.school_teacher_id is
  'Docente deduplicato dell evento usato dalle campagne con audience Professori.';
