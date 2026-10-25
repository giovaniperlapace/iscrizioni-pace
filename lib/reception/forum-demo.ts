import { parseReceptionCommand, type ReceptionResult, type ReceptionPerson } from "./contracts.ts";
import { parseDeskRequest, type DeskResult } from "./forum-desk.ts";
import { DEMO_DUTIES, DEMO_EVENT, DEMO_FORUM_ONE, DEMO_FORUM_TWO, DEMO_OPTION, DEMO_SAMPLES, demoId } from "./demo-samples.ts";

type Stats = {status:"ready";booked:number;entered:number;relayRooms:[]};
type Response = ReceptionResult | DeskResult | Stats;

// A local training model, not a substitute for the real SQL permission/capacity checks.
// It has no database, fetch, browser storage or dependency on production identities.
export function createForumReceptionDemo() {
  const people=DEMO_SAMPLES.map(sample => {
    const bookings=new Map<string,string[]>();
    if(sample.forum) bookings.set(sample.forum,[sample.id,...(sample.child?[sample.childId]:[])]);
    if(sample.ceremony) {bookings.set("opening",[sample.id]);bookings.set("closing",[sample.id]);}
    const entered=new Map<string,string>();
    if(sample.entered && sample.forum)entered.set(`${sample.forum}:${sample.id}`,"2026-10-25T08:00:00Z");
    return {...sample,bookings,entered,revisions:new Map<string,number>()};
  });
  const receipts=new Map<string,string>();
  const stats=(target:string):Stats => ({status:"ready",relayRooms:[],
    booked:people.reduce((sum,p)=>sum+(p.bookings.get(target)?.length??0),0),
    entered:people.reduce((sum,p)=>sum+[...p.entered.keys()].filter(key=>key.startsWith(`${target}:`)).length,0),
  });
  async function request(eventId:string,body:object):Promise<Response> {
    if(eventId!==DEMO_EVENT)return {status:"forbidden"};
    const input=body as Record<string,unknown>;
    if(input.operation==="statistics")return DEMO_DUTIES.some(d=>d.key===input.target)?stats(String(input.target)):{status:"invalid_request"};
    const scan=input.operation==="scan"?parseReceptionCommand(input.command):null;
    const desk=input.operation==="desk"?parseDeskRequest(input.command):null;
    if(!scan&&!desk)return {status:"invalid_request"};
    if(scan?.duty==="registration_check") {
      const person=people.find(p=>scan.lookup.kind==="qr"?p.token===scan.lookup.value:p.code===scan.lookup.value);
      if(!person || person.invalid)return {status:"invalid"};
      return {status:"valid",kind:"family",code:person.code,revision:0,registrationStatus:"confirmed",outcome:"verified",
        persons:[{id:person.id,kind:"adult",firstName:person.name,lastName:"Prova",checkedInAt:person.eventMissing?null:"2026-10-25T08:00:00Z"}]};
    }
    const target=scan?.panelId??desk!.target;
    const duty=DEMO_DUTIES.find(d=>d.key===target);
    if(!duty || scan && scan.duty!==(duty.kind==="panel"?"panel_entry":"ceremony_entry"))return {status:"invalid_request"};
    const lookup=scan?.lookup??desk!.lookup;
    const person=people.find(p=>lookup.kind==="qr"?p.token===lookup.value:p.code===lookup.value);
    if(!person || person.invalid)return {status:"invalid"};
    const ceremony=duty.kind==="ceremony";
    const booked=person.bookings.get(duty.key)??[];
    const revision=person.revisions.get(duty.key)??0;
    const requestId=scan?.requestId??desk?.request;
    const fingerprint=JSON.stringify(body);
    const previous=requestId?receipts.get(requestId):undefined;
    if(previous && previous!==fingerprint)return {status:"invalid_request"};
    if(desk) {
      if(desk.operation==="preview")return {status:"ready",name:`${person.name} Prova`,
        options:[{id:DEMO_OPTION,label:ceremony?"Settore prova · Quota fittizia":"Posti individuali di prova",available:Math.max(0,20-stats(duty.key).booked)}],
        children:!ceremony&&person.child?[{id:person.childId,name:"Luca Prova"}]:[],
      };
      if(previous)return {status:"saved"};
      if(desk.option!==DEMO_OPTION || desk.children?.some(id=>!person.child||id!==person.childId))return {status:"invalid_request"};
      if(booked.length)return {status:"already_booked"};
      if(!ceremony && [DEMO_FORUM_ONE,DEMO_FORUM_TWO].some(key=>key!==duty.key&&person.bookings.has(key)))return {status:"booking_conflict"};
      const subjects=[person.id,...(desk.children??[])];
      if(stats(duty.key).booked+subjects.length>20)return {status:"capacity_exceeded"};
      person.bookings.set(duty.key,subjects);
      receipts.set(desk.request!,fingerprint);
      return {status:"saved"};
    }
    if(!scan)return {status:"invalid_request"};
    if(!ceremony&&!booked.length)return {status:"not_booked",routes:DEMO_DUTIES.filter(d=>d.kind==="panel"&&person.bookings.has(d.key)).map(d=>({title:d.title,room:d.room}))};
    if(scan.action!=="inspect"&&!previous) {
      if(!["enter","cancel"].includes(scan.action)||!scan.subjectIds?.length)return {status:"invalid_request"};
      if(scan.subjectIds.some(id=>id!==person.id && (!person.child||id!==person.childId)))return {status:"invalid_request"};
      if(scan.action==="enter"&&scan.subjectIds.some(id=>!booked.includes(id)))return {status:"not_booked"};
      if(scan.action==="enter"&&!ceremony&&person.eventMissing&&scan.reason!=="event_entry_override")return {status:"event_entry_required"};
      if(scan.action==="cancel"&&scan.expectedRevision!==revision)return {status:"conflict"};
      for(const id of scan.subjectIds){const key=`${duty.key}:${id}`;if(scan.action==="cancel")person.entered.delete(key);else if(!person.entered.has(key))person.entered.set(key,new Date().toISOString());}
      person.revisions.set(duty.key,revision+1);
      receipts.set(scan.requestId!,fingerprint);
    }
    const subjects=ceremony?[person.id,...(person.child?[person.childId]:[])]:booked;
    const persons:ReceptionPerson[]=subjects.map(id=>({
      id,kind:id===person.id?"adult":"child",firstName:id===person.id?person.name:"Luca",lastName:"Prova",
      checkedInAt:person.entered.get(`${duty.key}:${id}`)??null,
      ...(ceremony?{eligible:booked.includes(id),ceremonies:booked.includes(id)?[{
        kind:duty.key as "opening"|"closing",sector:person.ceremony?(duty.key==="opening"?"Settore Blu":"Settore Verde"):"Settore prova",
        needsSeat:true,review:false,seat:person.ceremony?{id:demoId(duty.key==="opening"?300:301),row:duty.key==="opening"?"A":"B",number:duty.key==="opening"?"12":"8",mapVersion:1}:null,
      }]:[]}:{eventCheckedIn:!person.eventMissing}),
    }));
    return {status:"valid",kind:"family",code:person.code,persons,revision:person.revisions.get(duty.key)??0,
      registrationStatus:"confirmed",outcome:scan.action==="inspect"?"verified":previous?"replayed":"saved",
      ...(!ceremony?{panel:{id:duty.key,title:duty.title,room:duty.room!,section:"Posti di prova"}}:{}),
    };
  }
  return {request};
}
