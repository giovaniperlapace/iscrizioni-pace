create or replace function app.generate_participant_public_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  candidate text;
  attempt integer;
begin
  for attempt in 1..100 loop
    candidate := '';

    for _ in 1..4 loop
      candidate := candidate || substr(
        alphabet,
        floor(random() * length(alphabet) + 1)::integer,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.participants
      where public_code = candidate
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'Unable to generate a unique participant public code';
end;
$$;

alter table public.participants
  add column public_code text;

do $$
declare
  participant_record record;
begin
  for participant_record in
    select id
    from public.participants
    where public_code is null
    order by created_at, id
  loop
    update public.participants
    set public_code = app.generate_participant_public_code()
    where id = participant_record.id;
  end loop;
end;
$$;

alter table public.participants
  alter column public_code set not null,
  add constraint participants_public_code_format_check
    check (public_code ~ '^[A-Z0-9]{4}$'),
  add constraint participants_public_code_key unique (public_code);

create or replace function app.set_participant_public_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.public_code is null or new.public_code = '' then
    new.public_code := app.generate_participant_public_code();
  else
    new.public_code := upper(new.public_code);
  end if;

  return new;
end;
$$;

create trigger set_participant_public_code
before insert on public.participants
for each row
execute function app.set_participant_public_code();
