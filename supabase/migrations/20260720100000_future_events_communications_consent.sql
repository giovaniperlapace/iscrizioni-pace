-- Record optional, explicit consent for communications about future events.

alter table public.participant_consents
  add column if not exists future_events_communications_accepted boolean not null default false,
  add column if not exists future_events_communications_accepted_at timestamptz,
  add column if not exists future_events_communications_consent_version text;

alter table public.participant_consents
  drop constraint if exists participant_consents_future_events_communications_consistency;

alter table public.participant_consents
  add constraint participant_consents_future_events_communications_consistency
  check (
    (
      future_events_communications_accepted
      and future_events_communications_accepted_at is not null
      and future_events_communications_consent_version is not null
    )
    or (
      not future_events_communications_accepted
      and future_events_communications_accepted_at is null
      and future_events_communications_consent_version is null
    )
  );
