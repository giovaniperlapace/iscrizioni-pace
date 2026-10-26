-- Entry instructions are sent through separate campaigns. Keep the explicit
-- delivery gate, Admin authorization, revision check and audit unchanged.
-- Installing this migration does not enable delivery or enqueue any email.
create or replace function app.closing_badge_instructions_valid(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select value='{}'::jsonb or (jsonb_typeof(value)='object' and not exists(
  select 1 from unnest(array['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN']) code
  cross join unnest(array['it','en']) locale
  where jsonb_typeof(value->code->locale) is distinct from 'string'
   or length(btrim(value->code->>locale)) not between 1 and 12000))
$$;
