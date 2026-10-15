-- One explicit print request may include both new and previously requested
-- labels. Preserve the canonical records, snapshots, atomic claim and grants.
begin;
do $$
declare definition text; target regprocedure := 'public.qr_label_queue(uuid,uuid,text,uuid,uuid,uuid[],text,uuid,text,text)'::regprocedure;
begin
 definition := pg_get_functiondef(target);
 if strpos(definition, 'p_action not in (''read'',''print'',''reprint'',''verify'',''outcome'')') = 0
   or strpos(definition, 'p_action in (''print'',''reprint'')') = 0
   or strpos(definition, '''qr_label.''||p_action') = 0 then
  raise exception 'Unexpected QR label queue definition';
 end if;
 definition := replace(definition,
  'p_action not in (''read'',''print'',''reprint'',''verify'',''outcome'')',
  'p_action not in (''read'',''print'',''reprint'',''request'',''verify'',''outcome'')');
 definition := replace(definition, 'p_action in (''print'',''reprint'')', 'p_action in (''print'',''reprint'',''request'')');
 -- Keep the existing per-person print/reprint audit semantics for mixed runs.
 definition := replace(definition, '''qr_label.''||p_action',
  '''qr_label.''||case when p_action=''request'' then case when row->>''state''=''pending'' then ''print'' else ''reprint'' end else p_action end');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
