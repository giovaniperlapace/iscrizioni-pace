begin;
-- One-off early selection for the requested event/date. No assignment, booking
-- or check-in changes; the existing 26 October 13:30 closing boundary remains.
do $$
declare definition text;
 old_expression text := $old$'availableFrom',(duty_day + case when key='opening' then time '13:30' when morning then time '07:30' else time '13:30' end) at time zone 'Europe/Rome'$old$;
 new_expression text := $new$'availableFrom',case
   when p_event='d302dff4-f08d-4040-8d83-9ec2042a73d5'::uuid
    and kind='panel' and morning and duty_day=date '2026-10-26'
   then timestamptz '2026-10-25 18:25:00 Europe/Rome'
   else (duty_day + case when key='opening' then time '13:30' when morning then time '07:30' else time '13:30' end) at time zone 'Europe/Rome' end$new$;
begin
 select pg_get_functiondef('app.reception_duty_catalog(uuid)'::regprocedure) into definition;
 if length(definition)-length(replace(definition,old_expression,''))<>length(old_expression) then
  raise exception 'Unexpected reception availability definition';
 end if;
 execute replace(definition,old_expression,new_expression);
end $$;
commit;
