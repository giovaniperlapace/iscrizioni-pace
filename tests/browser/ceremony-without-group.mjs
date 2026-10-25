import assert from 'node:assert/strict';

export async function checkWithoutGroup({page,base,query}) {
  query("insert into participants(id,first_name,last_name,public_code) select f(16000+n),'Ungrouped','Member '||lpad(n::text,3,'0'),'U'||lpad(n::text,3,'0') from generate_series(1,105) n;insert into registrations(id,event_id,participant_id,status) select f(16200+n),f(1),f(16000+n),'submitted' from generate_series(1,105) n;insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(f(16400),f(16201),1,'Ungrouped','Minor','2019-01-01');select 'null'::jsonb;");
  const adults=query("select count(*) from registrations r where r.event_id=f(1) and r.deleted_at is null and r.status in ('submitted','confirmed') and not exists(select 1 from participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed') and not exists(select 1 from ceremony_nominees n where n.registration_id=r.id and n.child_id is null and n.revoked_at is null)");
  const total=adults+1;
  assert.ok(adults>=105);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1100});
    await page.goto(base+'/ceremony-draft-check',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/^Settore F ·/}).click();
    const modal=page.getByRole('dialog',{name:'Settore F',exact:true});
    await modal.getByLabel('Modalità di assegnazione').selectOption('group_nominal');
    await modal.getByLabel('Gruppo per assegnazione nominale').selectOption({label:'Senza gruppo'});
    const all=modal.getByLabel(`Seleziona tutti i membri adulti disponibili (${adults})`,{exact:true});
    await all.waitFor();
    assert.equal(await modal.getByLabel('Seleziona Other Test',{exact:true}).count(),0,'confirmed group member excluded');
    await modal.getByLabel('Seleziona Ungrouped Member 001',{exact:true}).check();
    await modal.getByText('1 destinatari selezionati',{exact:true}).waitFor();
    await modal.getByLabel('Cerca nel gruppo').fill('Member 001');
    await all.check();
    await modal.getByText(`${adults} destinatari selezionati`,{exact:true}).waitFor();
    assert.equal(await modal.getByLabel('Includi esplicitamente tutti i minori disponibili (1)').isChecked(),false);
    await modal.getByLabel('Includi esplicitamente tutti i minori disponibili (1)').check();
    await modal.getByText(`${total} destinatari selezionati`,{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`/tmp/pace-ceremony-without-group-${width}.png`,fullPage:true});
    await modal.getByRole('button',{name:'Salva assegnazione in bozza',exact:true}).click();
    await modal.getByText('Bozza salvata. Visibile solo ad Admin e Manager fino alla pubblicazione.',{exact:true}).waitFor();
    const draft=query("select data from ceremony_assignment_drafts where state='draft' and data->>'action'='group_nominal' and data->>'groupId' is null");
    assert.equal(draft.quantity,total);assert.equal(draft.groupId,null);assert.equal(draft.subjects.length,total);
    assert.equal(query("select count(*) from ceremony_nominees where registration_id in(select f(16200+n) from generate_series(1,105) n)"),0);
    await modal.getByRole('button',{name:`Rimuovi bozza Senza gruppo · ${total} nomi`,exact:true}).click();
    await modal.getByText('Bozza rimossa.',{exact:true}).waitFor();
    await modal.getByLabel('Gruppo per assegnazione nominale').selectOption({label:'Senza gruppo'});
    await all.waitFor();await all.check();
    await modal.getByLabel('Gruppo per assegnazione nominale').selectOption({label:'Leader group'});
    await modal.getByLabel('Seleziona tutti i membri adulti disponibili (1)',{exact:true}).waitFor();
    assert.equal(await modal.getByRole('region',{name:'Destinatari nominali del gruppo'}).count(),0,'group change resets selection');
    await modal.getByRole('button',{name:'Chiudi',exact:true}).click();
  }
  console.log('PASS Senza gruppo browser desktop/mobile: individual selection, all available adults across pages/search (105 new fixtures), explicit minor, draft save/remove, no public assignments, group switch reset');
}
