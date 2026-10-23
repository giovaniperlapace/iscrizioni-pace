-- Production programme only. Empty development databases have no Assisi source IDs.
-- Rooms are staged: visible after publication, but no offers/bookings until activation.
do $$
declare cfg record; original public.event_moments%rowtype; audience uuid; count_sources integer;
begin
 select count(*) into count_sources from public.event_moments where id in ('fc9f3085-dabf-4e2d-b01b-7ccaf1b984da','2eb7bdd0-72b3-4c94-9db2-064be7d37caa','e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f','db14374f-3297-4aab-b325-4b4a5506a8dc','20aa5c45-1e8c-4f8d-a757-cb1b0624e959','fbfd9fbe-aebc-4438-8b88-a4e379e00e3c');
 if count_sources=0 then return; end if;
 if count_sources<>6 then raise exception 'incomplete Assisi source programme'; end if;
 for cfg in select * from (values
 ('dbcee5e7-c080-42b5-a2d3-d54f485b5706'::uuid,'fc9f3085-dabf-4e2d-b01b-7ccaf1b984da'::uuid,'3e30d388-2fdc-401d-a8e0-40a582b70a9a'::uuid,'04cec46a-0d84-4927-8403-109d061a8afd'::uuid,156,'Domus Letitiae'),
 ('ef811c92-8ab6-478f-bd1d-296046ac5eb8'::uuid,'2eb7bdd0-72b3-4c94-9db2-064be7d37caa'::uuid,'27a129ca-8ae0-41fa-afdf-0ce2d579373e'::uuid,'41c0d31c-68cc-44f3-b271-26e3245ab40c'::uuid,110,'Serafico'),
 ('35b59eba-f64d-4773-aa3c-75293f9eede7'::uuid,'e8d77bc5-1559-4fc9-bea8-1e8d84f8ab0f'::uuid,'e5b97b29-5181-42a2-bbca-dc1660c04dd1'::uuid,'04cec46a-0d84-4927-8403-109d061a8afd'::uuid,156,'Domus Letitiae'),
 ('b3489a23-9b47-4ed9-b49d-39ea22ce8c14'::uuid,'db14374f-3297-4aab-b325-4b4a5506a8dc'::uuid,'6fc9ba35-ebf0-4fca-8dec-69b98ac51b7e'::uuid,'41c0d31c-68cc-44f3-b271-26e3245ab40c'::uuid,110,'Serafico'),
 ('dd35fb5c-5083-49b5-af59-3016c4e34a81'::uuid,'20aa5c45-1e8c-4f8d-a757-cb1b0624e959'::uuid,'f72cb1f4-4e76-45f4-bdb3-5a5289678a67'::uuid,'41c0d31c-68cc-44f3-b271-26e3245ab40c'::uuid,110,'Serafico'),
 ('4b8db0c8-65d9-4f26-a2d6-6c29c72fc8b9'::uuid,'fbfd9fbe-aebc-4438-8b88-a4e379e00e3c'::uuid,'c3f371f8-e6e7-42a7-9b82-a9323e8df44e'::uuid,'04cec46a-0d84-4927-8403-109d061a8afd'::uuid,156,'Domus Letitiae')
 ) v(panel_id,source_id,section_id,location_id,capacity,venue) loop
  select * into strict original from public.event_moments where id=cfg.source_id for update;
  if original.event_id<>'d302dff4-f08d-4040-8d83-9ec2042a73d5'::uuid or original.publication_status<>'published'
   or not original.is_public or original.starts_at<=clock_timestamp() then raise exception 'unexpected source Forum'; end if;
  select id into strict audience from public.panel_audience_types where event_id=original.event_id
   and code='registered' and booking_channel='individual' and is_active;
  insert into public.event_locations(id,event_id,name,address,city,country,max_capacity)
   values(cfg.location_id,original.event_id,cfg.venue||' — Assisi',case when cfg.venue='Serafico' then 'Viale Guglielmo Marconi 6' else 'Viale Giovanni XXIII 2' end,'Assisi','IT',cfg.capacity)
   on conflict(id) do nothing;
  insert into public.event_moments(id,event_id,location_id,title,description,starts_at,ends_at,capacity,
   moment_type,publication_status,is_public,check_in_enabled)
   values(cfg.panel_id,original.event_id,cfg.location_id,
    split_part(original.title,' - ',1)||' — SALA COLLEGATA — SOLO IN ITALIANO — '||cfg.venue||' — '||substring(original.title from position(' - ' in original.title)+3),
    'TRASMISSIONE ESCLUSIVAMENTE IN ITALIANO, SENZA TRADUZIONI. Collegamento in diretta con '||original.title||'. I relatori si trovano nella sala principale. Questa prenotazione consente l’ingresso soltanto alla sala collegata '||cfg.venue||', '||case when cfg.venue='Serafico' then 'Viale Guglielmo Marconi 6, Assisi. Raggiungibile con la navetta Linea C o con mezzi propri. Parcheggio limitato.' else 'Viale Giovanni XXIII 2, Assisi. Raggiungibile con la navetta Linea C o con mezzi propri. Ampio parcheggio.' end,
    original.starts_at,original.ends_at,cfg.capacity,'panel','draft',false,true);
  insert into public.panel_seat_sections(id,event_id,panel_id,audience_type_id,capacity)
   values(cfg.section_id,original.event_id,cfg.panel_id,audience,cfg.capacity);
  insert into public.panel_relay_rooms(panel_id,source_panel_id) values(cfg.panel_id,cfg.source_id);
  update public.event_moments set publication_status='published',is_public=true,published_at=clock_timestamp() where id=cfg.panel_id;
  perform app.validate_panel_configuration(cfg.panel_id);
 end loop;
end;
$$;
