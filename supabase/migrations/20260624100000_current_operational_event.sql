alter table public.events
  add column if not exists is_current boolean not null default false;

with selected_event as (
  select id
  from public.events
  order by
    case
      when slug = 'assisi-2026-test' then 0
      when status = 'published' then 1
      else 2
    end,
    starts_on desc nulls last,
    created_at desc
  limit 1
)
update public.events
set is_current = (id = (select id from selected_event))
where not exists (
  select 1 from public.events where is_current = true
);

create unique index if not exists events_single_current_idx
  on public.events (is_current)
  where is_current = true;
