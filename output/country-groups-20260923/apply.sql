begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.countries, public.groups in share row exclusive mode;
create temporary table requested_countries(iso2 text, name_it text, name_en text, existing_group_id uuid) on commit drop;
insert into requested_countries values
('CU','Cuba','Cuba',null),
('GT','Guatemala','Guatemala',null),
('CO','Colombia','Colombia',null),
('NI','Nicaragua','Nicaragua',null),
('MX','Messico','Mexico',null),
('CI','Costa d’Avorio','Ivory Coast','ca68d3a4-8963-407a-afc7-71082042c69e'),
('NG','Nigeria','Nigeria','458b1119-3b62-4804-8631-034d29f884b2'),
('SN','Senegal','Senegal','0f8adf88-c693-4765-8660-6ab5eafcc03d'),
('MZ','Mozambico','Mozambique','b7f1419e-3109-4f2a-b896-8342653c6ba2'),
('CD','Repubblica Democratica del Congo','Democratic Republic of the Congo','0aa19f40-4e87-4ac9-a932-8b1bc0197928'),
('MW','Malawi','Malawi','dfef8d5c-a832-4c6f-a692-a673a65e5f63'),
('UG','Uganda','Uganda',null);
DO $$
declare
  event_id_value uuid := 'd302dff4-f08d-4040-8d83-9ec2042a73d5';
  r record;
  cid uuid;
  gid uuid;
  old_group jsonb;
  new_group jsonb;
  next_order integer;
begin
  if not exists(select 1 from public.events where id=event_id_value and is_current and status='published') then raise exception 'Current event changed'; end if;
  if exists(select 1 from public.countries c join requested_countries req on c.iso2=req.iso2 or c.name_it=req.name_it or c.name_en=req.name_en) then raise exception 'Country catalog changed; inspect before retry'; end if;
  select coalesce(max(public_order),0) into next_order from public.groups where event_id=event_id_value;
  for r in select * from requested_countries order by name_it loop
    insert into public.countries(iso2,name_it,name_en,is_active) values(r.iso2,r.name_it,r.name_en,true) returning id into cid;
    insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(event_id_value,'country.created','countries',cid,jsonb_build_object('source','user_requested_country_groups_20260923','iso2',r.iso2));
    old_group := null;
    if r.existing_group_id is not null then
      select to_jsonb(g) into old_group from public.groups g where id=r.existing_group_id and event_id=event_id_value and country_id is null and city_id is null and parent_group_id is null and node_type='group' and community_kind='santegidio' and is_active and is_assignable and is_public_catalog and cardinality(age_brackets)=0;
      if old_group is null then raise exception 'Existing group changed for %',r.iso2; end if;
      update public.groups set country_id=cid where id=r.existing_group_id returning id,to_jsonb(groups.*) into gid,new_group;
    else
      next_order := next_order+10;
      insert into public.groups(event_id,name,public_label,country_id,node_type,community_kind,is_active,is_assignable,is_public_catalog,age_brackets,public_order) values(event_id_value,r.name_it,r.name_it,cid,'group','santegidio',true,true,true,'{}',next_order) returning id,to_jsonb(groups.*) into gid,new_group;
    end if;
    insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(event_id_value,case when old_group is null then 'group.created' else 'group.updated' end,'groups',gid,jsonb_build_object('source','user_requested_country_groups_20260923','iso2',r.iso2,'before',old_group,'after',new_group));
  end loop;
  if (select count(*) from requested_countries req join public.countries c on c.iso2=req.iso2 join public.groups g on g.country_id=c.id and g.event_id=event_id_value where g.node_type='group' and g.community_kind='santegidio' and g.is_active and g.is_assignable and g.is_public_catalog and g.city_id is null and cardinality(g.age_brackets)=0) <> 12 then raise exception 'Final verification failed'; end if;
end $$;
select c.iso2,c.name_it,g.name as group_name,g.id as group_id,g.node_type,g.is_public_catalog,g.is_assignable from requested_countries req join public.countries c on c.iso2=req.iso2 join public.groups g on g.country_id=c.id order by c.name_it;
commit;
