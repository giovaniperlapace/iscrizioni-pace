"use client";
import { useState } from "react";
import { ParticipantPanelBookings } from "@/app/dashboard/partecipante/participant-panel-bookings";
import { GroupPanelBookings } from "@/app/dashboard/capogruppo/panel/panel-bookings";
import { fixtureRows, fixtureRegistrationId } from "./forum-waitlist-fixture";
import type { SupportedLocale } from "@/lib/i18n/config";
const children = [{id:"11111111-1111-4111-8111-111111111191",name:"Minore Uno",selected:false},{id:"11111111-1111-4111-8111-111111111192",name:"Minore Due",selected:false}];
export default function Fixture({locale = "it"}: {locale?: SupportedLocale}) {
 const [view,setView] = useState("participant");
 return <main className="mx-auto max-w-6xl p-4"><button onClick={()=>setView(view==="participant"?"group":"participant")}>Switch view</button>
 {view==="participant" ? <ParticipantPanelBookings locale={locale} registrationId={fixtureRegistrationId}
 rows={fixtureRows.map((r,i)=>({...r,children:children.map(c=>({...c,selected:i>=2&&i!==4&&c.id===children[0].id})),party_size:i>=2&&i!==4?2:1,
 remaining_seats:i===1?0:1,has_waiting:i===1,has_slot_conflict:i===4}))} /> :
 <GroupPanelBookings locale={locale} sectionId="section-0" view={{panels:[{panelId:fixtureRows[0].panel_id,sectionId:"section-0",title:"Forum gruppo",audience:"Iscritti",startsAt:fixtureRows[0].starts_at,endsAt:fixtureRows[0].ends_at,location:"Sala",remaining:1}],participants:[
 {registrationId:fixtureRegistrationId,name:"Adulto Test",code:"TEST",groupId:"group",groupName:"Gruppo",seats:1,status:"available",children},
 {registrationId:"11111111-1111-4111-8111-111111111193",name:"Adulto Prenotato",code:"TST2",groupId:"group",groupName:"Gruppo",seats:2,status:"selected",children:children.map((c,i)=>({...c,selected:i===0}))}]}} />}
 </main>;
}
