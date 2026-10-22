"use client";
import type { ReceptionCommand, ReceptionResult } from '@/lib/reception/contracts';
import { EventReceptionConsole } from '@/app/dashboard/accoglienza/event-reception-console';
import { useState } from 'react';
import type { DeskCommand, SeatsDesk, SeatPerson } from '@/lib/ceremonies/seats-desk';
import { parseOperationsDashboardFilters } from '@/lib/registrations/operations-dashboard';
import { CeremonySeatsWorkspace } from '@/app/dashboard/ceremony-seats-workspace';
export default function Fixture({initial,people,command,scan}: {initial:SeatsDesk;people:SeatPerson[];scan:(c:ReceptionCommand)=>Promise<ReceptionResult>;command:(c:DeskCommand)=>Promise<{status:string;desk:SeatsDesk}>}) {
 const [desk,setDesk]=useState(initial),[payload,setPayload]=useState('');
 return <main className="mx-auto max-w-6xl p-4"><h1>Posti cerimonie · collaudo sintetico</h1><output data-testid="payload" className="sr-only">{payload}</output><CeremonySeatsWorkspace desk={desk} people={people} page={{page:1,pageCount:1,first:1,last:people.length,total:people.length}} filterProps={{dashboard:'manager',navMode:'mini',filters:parseOperationsDashboardFilters({}),groupOptions:[{id:'11111111-1111-4111-8111-111111111111',eventId:'event',name:'Delegazione prova'}],eventServices:[],operationalTags:[]}} save={async c=>{setPayload(JSON.stringify(c));const result=await command(c);setDesk(result.desk);return result;}}/><section aria-label="Scanner di prova" className="mt-8"><EventReceptionConsole commandAction={scan} labelPrinting={false}/></section></main>;
}
