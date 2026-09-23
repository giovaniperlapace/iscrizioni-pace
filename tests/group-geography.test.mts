import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { groupCountryOptions, groupCityOptions, parseGroupGeography, type GroupGeographyCatalog } from "../lib/groups/geography.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n/config.ts";
import { loadGroupGeographyCatalog } from "../lib/groups/geography.server.ts";
import { createClient } from "@supabase/supabase-js";
import { formFailure, formFailureFromRedirect } from "../lib/forms/result.ts";

const id = "11111111-1111-4111-8111-111111111111";
const cityId = "22222222-2222-4222-8222-222222222222";
const catalog: GroupGeographyCatalog = { countries: [{id,iso2:"CO",name_it:"Colombia",name_en:"Colombia",is_active:true}], cities:[{id:cityId,country_id:id,name:"Bogotá",is_active:true}] };
function form(country = "iso:CO", city = "name:Bogotá") {
  const data = new FormData();
  for (const [key,value] of Object.entries({sourceDashboard:"manager",name:"Test group",groupNodeType:"group",eventId:"event",groupGeographyPresent:"1",groupCountry:country,groupCity:city,actorUserId:"forged"})) data.set(key,value);
  return data;
}
test("country/city options reuse real catalog IDs and support all seven locales", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const countries=groupCountryOptions(catalog,locale);
    assert.equal(countries.filter(c=>c.name==='Colombia').length,1);
    assert.equal(countries.find(c=>c.name==='Colombia')?.value,id);
    const cities=groupCityOptions(catalog,id,locale);
    assert.equal(cities.filter(c=>c.label==='Bogotá').length,1);
    assert.equal(cities.find(c=>c.label==='Bogotá')?.value,cityId);
    assert.ok(!groupCityOptions(catalog,'iso:CU',locale).some(c=>c.label==='Bogotá'));
  }
});
test("server derives ISO labels, rejects regions/forged fields and preserves explicit clearing", () => {
  const parsed=parseGroupGeography(form());assert.ok(parsed.ok);
  assert.equal(parsed.value.country_code,'CO');assert.equal(parsed.value.city_normalized_name,'bogota');
  assert.deepEqual(parseGroupGeography(form('','')), {ok:true,value:{}});
  for(const country of ['iso:AFRICA','iso:ZZ','America Latina','forged']) assert.equal(parseGroupGeography(form(country)).ok,false);
  const missing=form();missing.delete('groupGeographyPresent');assert.equal(parseGroupGeography(missing).ok,false);
  const custom=form(id,'__other__');custom.set('groupCityOther','  Santa   Marta  ');
  const result=parseGroupGeography(custom);assert.ok(result.ok);assert.equal(result.value.city_name,'Santa Marta');
  custom.set('groupCityOther','x'.repeat(121));assert.equal(parseGroupGeography(custom).ok,false);
});
test("geography loader reads later pages and never returns a partial catalog on failure",async()=>{
  for(const fail of [false,true]) {
    const db=createClient('https://example.test','test',{auth:{persistSession:false},global:{fetch:async(input)=>{
      const url=new URL(String(input));const offset=Number(url.searchParams.get('offset'));
      if(url.pathname.endsWith('/countries'))return Response.json(catalog.countries);
      if(offset===0)return Response.json(Array.from({length:500},(_,i)=>({...catalog.cities[0],id:String(i)})));
      if(fail)return Response.json({message:'failed'},{status:500});
      return Response.json(catalog.cities);
    }}});
    if(fail) await assert.rejects(loadGroupGeographyCatalog(db));
    else assert.equal((await loadGroupGeographyCatalog(db)).cities.length,501);
  }
});
function harness(role='manager',error: string|null=null) {
  const calls: Record<string,unknown>[]=[];const paths:string[]=[];const mutations:string[]=[];
  const source=readFileSync(new URL('../app/actions.ts',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('export async function saveOperationsGroup'),source.indexOf('export async function updateGroupPublicCatalogVisibility'));
  const current = {id,event_id:'event',community_kind:'santegidio',age_brackets:[],is_assignable:true,is_public_catalog:true,is_active:true,public_order:100};
  const builder = {select(){return this;},eq(){return this;},async maybeSingle(){return {data:current,error:null};}};
  const db={from:()=>builder,rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,...args});return {data:id,error:error?{code:error}:null};}};
  const deps={optionalText:(v:unknown)=>v?String(v):null,getGroupManagementDashboardPath:()=>'/dashboard/manager',getGroupManagementRequestedRole:()=>role,isValidGroupNodeType:(n:string)=>['group','city','country','area'].includes(n),createSupabaseServerClient:async()=>({}),getCurrentAuthContext:async()=>({user:{id:'session-actor'},eventRoles:[{role,eventId:'event'}]}),createSupabaseServiceClient:()=>db,loadAllRows:async()=>({data:[],error:null}),collectDescendantGroupIds:()=>new Set(),isValidGroupCommunityKind:()=>true,isValidGroupAgeBand:()=>true,parseGroupGeography,normalizeGroupRegistrationPublicLabel:(n:string)=>n,normalizeEmail:(v:unknown)=>String(v??''),formFailure,formFailureFromRedirect,revalidatePath:(p:string)=>paths.push(p),redirect:(p:string)=>{throw new Error(p);},getNewGroupLeaderTarget:async()=>{mutations.push('identity');return {ok:true};},assignPrimaryGroupLeaderToGroup:async()=>null};
  const js=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText.replace(/exports\.saveOperationsGroup = saveOperationsGroup;/,'');
  const action=new Function('exports',...Object.keys(deps),`${js}; return saveOperationsGroup;`)({},...Object.values(deps));
  return {action,calls,paths,mutations};
}
test("group save sends geography and session actor to atomic RPC and refreshes public catalog",async()=>{
  const h=harness();await assert.rejects(h.action(form()),/groupSaved=1/);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].p_actor_user_id,'session-actor');assert.equal(h.calls[0].name,'save_operational_group');
  assert.ok(h.paths.includes('/registrazione'));
});
test("viewer and invalid geography cannot write, stale/hierarchy errors retain data without identity writes",async()=>{
  const forbidden=harness('manager_viewer');assert.equal((await forbidden.action(form())).status,'error');assert.equal(forbidden.calls.length,0);
  const invalid=harness();assert.equal((await invalid.action(form('Africa'))).status,'error');assert.equal(invalid.calls.length,0);
  for(const [error,code] of [['PT409','groupConflict'],['PT422','groupTerritory'],['42501','forbidden']]) {
    const h=harness('manager',error);const data=form();data.set('primaryLeaderUserId','__new__');data.set('leaderFirstName','Synthetic');data.set('leaderLastName','Leader');data.set('leaderEmail','synthetic@example.test');
    assert.deepEqual(await h.action(data),formFailure([{field:null,code}]));assert.equal(h.mutations.length,0);assert.equal(h.paths.length,0);
  }
});

test("editing keeps explicit catalog IDs and the exact version; missing geography/version cannot erase links",async()=>{
  const h=harness();const data=form(id,cityId);data.set('groupId',id);data.set('groupExpectedUpdatedAt','2026-09-23T12:00:00.123456+00:00');
  await assert.rejects(h.action(data),/groupSaved=1/);
  assert.equal(h.calls[0].p_group_id,id);
  assert.equal(h.calls[0].p_expected_updated_at,'2026-09-23T12:00:00.123456+00:00');
  assert.deepEqual(h.calls[0].p_geography,{country_id:id,city_id:cityId});
  for(const field of ['groupGeographyPresent','groupExpectedUpdatedAt']) {
    const invalid=harness();const copy=new FormData();for(const [k,v] of data)copy.set(k,v);copy.delete(field);
    assert.equal((await invalid.action(copy)).status,'error');assert.equal(invalid.calls.length,0);
  }
});

test("multiple cities validate every entry, deduplicate names and require an explicit scope", () => {
  const data = form(id, '');data.delete('groupCity');data.set('groupCityScope','cities');
  data.append('groupCities',cityId);data.append('groupCities','name:Perugia');data.append('groupCities','name:Pérugia');
  const parsed=parseGroupGeography(data);assert.ok(parsed.ok);
  assert.equal(parsed.value.city_scope,'cities');assert.equal(parsed.value.cities?.length,2);
  data.append('groupCities','forged');assert.equal(parseGroupGeography(data).ok,false);
  data.delete('groupCities');assert.equal(parseGroupGeography(data).ok,false);
  for(const scope of ['country','inherit']) {
    data.set('groupCityScope',scope);const clean=parseGroupGeography(data);assert.ok(clean.ok);assert.deepEqual(clean.value.cities,[]);
    data.append('groupCities',cityId);assert.equal(parseGroupGeography(data).ok,false);data.delete('groupCities');
  }
  data.set('groupCityScope','cities');for(let i=0;i<101;i++)data.append('groupCities',cityId);
  assert.equal(parseGroupGeography(data).ok,false);
});

test("city links are paginated within group batches and later-page errors fail closed", async () => {
  const { loadGroupCityLinks } = await import('../lib/groups/geography.server.ts');
  for(const fail of [false,true]) {
    const calls: URL[]=[];
    const db=createClient('https://example.test','test',{auth:{persistSession:false},global:{fetch:async input=>{
      const url=new URL(String(input));calls.push(url);const offset=Number(url.searchParams.get('offset'));
      if(fail && offset===500)return Response.json({message:'failed links'},{status:500});
      const rows=Array.from({length:1201},(_,i)=>({group_id:id,city_id:String(i)}));
      return Response.json(rows.slice(offset,offset+500));
    }}});
    if(fail) await assert.rejects(loadGroupCityLinks(db,[id]),/failed links/);
    else {assert.equal((await loadGroupCityLinks(db,[id])).get(id)?.length,1201);assert.equal(calls.length,3);}
  }
});
