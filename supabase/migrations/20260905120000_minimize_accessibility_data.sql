-- Deploy the application that no longer reads/writes the retired column first.
-- Irreversible data minimization: no copies of the removed content are retained.
begin;

-- Temporary recursive scrubber also handles old questionnaire versions and audit
-- metadata, without modifying unrelated operational notes (e.g. group/service).
create function pg_temp.scrub_retired_accessibility(data jsonb)
returns jsonb language plpgsql as $$
declare
  result jsonb;
begin
  if jsonb_typeof(data) = 'object' then
    select coalesce(jsonb_object_agg(key, pg_temp.scrub_retired_accessibility(value)), '{}'::jsonb)
      into result from jsonb_each(data)
      where key not in ('operationalNotes', 'operational_notes', 'accessibilityNotes', 'accessibility_notes', 'hasNotes');
    return result;
  elsif jsonb_typeof(data) = 'array' then
    select coalesce(jsonb_agg(pg_temp.scrub_retired_accessibility(value) order by ordinal), '[]'::jsonb)
      into result from jsonb_array_elements(data) with ordinality as entries(value, ordinal)
      where value not in ('"accessibility_notes"'::jsonb, '"operational_notes"'::jsonb);
    return result;
  end if;
  return data;
end;
$$;

update public.registration_questionnaire_answers
set answers = pg_temp.scrub_retired_accessibility(answers),
    visibility_summary = pg_temp.scrub_retired_accessibility(visibility_summary)
where answers is distinct from pg_temp.scrub_retired_accessibility(answers)
   or visibility_summary is distinct from pg_temp.scrub_retired_accessibility(visibility_summary);

-- Retire the separate group-leader callback request. Participant support remains.
update public.registration_questionnaire_answers
set answers = answers #- '{accessibility,needsOperationalSupport}'
where answers->>'source' = 'capogruppo_manual'
  and answers->'accessibility' ? 'needsOperationalSupport';

update public.accessibility_needs as a
set needs_operational_support = false
from public.registrations as r
where r.id = a.registration_id and r.source = 'capogruppo'
  and a.needs_operational_support
  and not exists (
    select 1 from public.audit_logs as audit
    where audit.entity_id = r.id
      and audit.action = 'participant.dashboard_updated'
      and audit.metadata->'changed_fields' ? 'needs_operational_support'
  );

update public.audit_logs
set metadata = pg_temp.scrub_retired_accessibility(metadata)
where metadata is distinct from pg_temp.scrub_retired_accessibility(metadata);

alter table public.accessibility_needs drop column operational_notes;

-- Reject attempts to reintroduce retired questionnaire properties from an old
-- client or a direct PostgREST request, while preserving version identifiers.
alter table public.registration_questionnaire_answers
  add constraint questionnaire_accessibility_keys_minimized check (
    not (answers ?| array['accessibilityNotes', 'accessibility_notes', 'operationalNotes', 'operational_notes', 'hasNotes'])
    and (
      not (answers ? 'accessibility') or (
        jsonb_typeof(answers->'accessibility') = 'object'
        and ((answers->'accessibility') - array['hasAccessibilityNeeds', 'washingtonGroupAnswers', 'needsOperationalSupport']) = '{}'::jsonb
      )
    )
  );

notify pgrst, 'reload schema';
commit;
