-- Disposable database only: minimal real PostgreSQL fixture, no participant data.
create table public.registrations (id integer primary key, source text);
create table public.accessibility_needs (
  registration_id integer, washington_group_answers jsonb,
  operational_notes text, needs_operational_support boolean
);
create table public.registration_questionnaire_answers (
  registration_id integer, questionnaire_version text, answers jsonb,
  visibility_summary jsonb
);
create table public.audit_logs (metadata jsonb, action text, entity_id integer);
insert into public.registrations values (1, 'public_form'), (2, 'capogruppo'), (3, 'capogruppo');
insert into public.accessibility_needs values
  (1, '{"hearing":true}', 'SYNTHETIC RETIRED VALUE', true),
  (2, '{"walkingOrSteps":true}', 'SYNTHETIC RETIRED VALUE', true),
  (3, '{"hearing":true}', null, true);
insert into public.registration_questionnaire_answers values
  (1, 'old-version', '{"accessibility":{"hasAccessibilityNeeds":true,"operationalNotes":"SYNTHETIC RETIRED VALUE","hasNotes":true,"needsOperationalSupport":true,"washingtonGroupAnswers":{"hearing":true}},"identity":{"firstName":"Test"}}', '{}'),
  (2, 'old-version', '{"source":"capogruppo_manual","accessibility":{"operationalNotes":"SYNTHETIC RETIRED VALUE","needsOperationalSupport":true,"washingtonGroupAnswers":{"walkingOrSteps":true}}}', '{}');
insert into public.audit_logs(metadata) values ('{"nested":[{"accessibilityNotes":"SYNTHETIC RETIRED VALUE"}],"changed":["phone","accessibility_notes"],"leader_internal_note":"keep"}');

insert into public.audit_logs values ('{"changed_fields":["needs_operational_support"]}', 'participant.dashboard_updated', 3);

\ir ../../supabase/migrations/20260905120000_minimize_accessibility_data.sql

do $$
begin
  assert not exists (select 1 from information_schema.columns where table_schema='public' and table_name='accessibility_needs' and column_name='operational_notes'), 'retired column remains';
  assert not exists (select 1 from public.registration_questionnaire_answers where answers::text like '%SYNTHETIC RETIRED VALUE%' or answers::text like '%hasNotes%'), 'snapshot values remain';
  assert not exists (select 1 from public.audit_logs where metadata::text like '%SYNTHETIC RETIRED VALUE%' or metadata::text like '%accessibility_notes%'), 'audit values remain';
  assert (select metadata->>'leader_internal_note' = 'keep' from public.audit_logs where action is null), 'unrelated note changed';
  assert (select needs_operational_support from public.accessibility_needs where registration_id=1), 'participant support lost';
  assert (select needs_operational_support from public.accessibility_needs where registration_id=3), 'later personal support request lost';
  assert not (select needs_operational_support from public.accessibility_needs where registration_id=2), 'retired callback flag remains';
  assert (select answers#>>'{accessibility,needsOperationalSupport}' = 'true' from public.registration_questionnaire_answers where registration_id=1), 'participant snapshot support lost';
  assert not (select answers->'accessibility' ? 'needsOperationalSupport' from public.registration_questionnaire_answers where registration_id=2), 'manual snapshot flag remains';
  assert (select answers#>>'{accessibility,washingtonGroupAnswers,hearing}' = 'true' from public.registration_questionnaire_answers where registration_id=1), 'structured answers changed';
  assert (select bool_and(questionnaire_version='old-version') from public.registration_questionnaire_answers), 'historical versions changed';
  begin
    update public.registration_questionnaire_answers set answers=jsonb_set(answers,'{accessibility,operationalNotes}','"blocked"');
    raise exception 'retired field was accepted';
  exception when check_violation then null;
  end;
end;
$$;
