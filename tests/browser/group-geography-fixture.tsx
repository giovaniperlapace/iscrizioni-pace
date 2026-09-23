"use client";
import { useState } from "react";
import { GroupPlacementFields } from "@/app/dashboard/group-edit-fields";
import { ReliableForm } from "@/components/reliable-form";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n/config";
const italy = "11111111-1111-4111-8111-111111111111";
const cuba = "22222222-2222-4222-8222-222222222222";
const rome = "33333333-3333-4333-8333-333333333333";
const groups = [
  { id:"parent",eventId:"test",name:"Italia",parentGroupId:null,nodeType:"country",countryId:italy,cityId:null,isAssignable:false },
  { id:"child",eventId:"test",name:"Gruppo Roma",parentGroupId:"parent",nodeType:"group",countryId:null,cityId:rome,isAssignable:true,updatedAt:"2026-09-23T00:00:00Z" },
];
const geography = { countries:[{id:italy,iso2:"IT",name_it:"Italia",name_en:"Italy",is_active:true},{id:cuba,iso2:"CU",name_it:"Cuba",name_en:"Cuba",is_active:true}],cities:[{id:rome,country_id:italy,name:"Roma",is_active:true}] };
export default function Fixture() {
 const [locale,setLocale]=useState<SupportedLocale>('it');const [edit,setEdit]=useState(false);const [sent,setSent]=useState('');
 return <main className="mx-auto max-w-2xl p-5">
  <select aria-label="Fixture language" value={locale} onChange={e=>setLocale(e.target.value as SupportedLocale)}>{SUPPORTED_LOCALES.map(l=><option key={l}>{l}</option>)}</select>
  <button onClick={()=>{setEdit(!edit);setSent('');}}>Toggle edit</button>
  <ReliableForm key={`${locale}-${edit}`} locale={locale} className="mt-5 grid gap-4 sm:grid-cols-2" action={async data=>{
   setSent(JSON.stringify(Object.fromEntries(data)));
   return {status:'error',issues:[{field:null,code:'groupTerritory'}]};
  }}>
   <GroupPlacementFields group={edit?groups[1]:null} groups={groups} eventId="test" geography={geography} locale={locale} />
   <button type="submit">Synthetic save</button>
  </ReliableForm>
  <output data-testid="payload">{sent}</output>
 </main>;
}
