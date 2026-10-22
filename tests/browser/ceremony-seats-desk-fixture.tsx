"use client";
import type { ReceptionCommand, ReceptionResult } from '@/lib/reception/contracts';
import { EventReceptionConsole } from '@/app/dashboard/accoglienza/event-reception-console';
import { useState } from 'react';
import type { DeskCommand, SeatsDesk, SeatPerson } from '@/lib/ceremonies/seats-desk';
import { parseOperationsDashboardFilters } from '@/lib/registrations/operations-dashboard';
import { readCeremonyHistory } from '@/app/dashboard/ceremony-history-read';
import type { HistoryQuery, HistoryResult, RevokeAssignment, RevokeSeat } from '@/lib/ceremonies/assignment-history';
import { CeremonySeatsPanel } from '@/app/dashboard/ceremony-seats-panel';
export default function Fixture({initial,people,command,scan,revoke,revokeSeat}: {history:(q:HistoryQuery)=>Promise<HistoryResult>;revokeSeat:(c:RevokeSeat)=>Promise<{status:string;desk:SeatsDesk}>;revoke:(c:RevokeAssignment)=>Promise<{status:string;desk:SeatsDesk}>;initial:SeatsDesk;people:SeatPerson[];scan:(c:ReceptionCommand)=>Promise<ReceptionResult>;command:(c:DeskCommand)=>Promise<{status:string;desk:SeatsDesk}>}) {
 const [desk,setDesk]=useState(initial),[payload,setPayload]=useState(''),[renders,setRenders]=useState(0);
 return <main className="mx-auto max-w-6xl p-4"><h1>Posti cerimonie · collaudo sintetico</h1><output data-testid="payload" className="sr-only">{payload}</output><button type="button" onClick={()=>setRenders(v=>v+1)}>Ridisegna {renders}</button><CeremonySeatsPanel loadHistory={async q=>readCeremonyHistory(q)} desk={desk} people={people} page={{page:1,pageCount:1,first:1,last:people.length,total:people.length}} filterProps={{dashboard:'manager',navMode:'mini',filters:parseOperationsDashboardFilters({}),groupOptions:[{id:'11111111-1111-4111-8111-111111111111',eventId:'event',name:'Delegazione prova'}],eventServices:[],operationalTags:[]}} save={async c=>{setPayload(JSON.stringify(c));const result=await command(c);setDesk(result.desk);return result;}} revokeSeat={async c=>{const result=await revokeSeat(c);setDesk(result.desk);return result;}} revoke={async c=>{const result=await revoke(c);setDesk(result.desk);return result;}}/><section aria-label="Scanner di prova" className="mt-8"><EventReceptionConsole commandAction={scan} labelPrinting={false}/></section></main>;
}
