// Isolated build only: synthetic table rows, original controls and Server Actions.
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OperationsParticipantsTable } from "@/app/dashboard/operations-participants-table";
import { EventAttendanceProvider } from "@/app/dashboard/event-attendance";
import { parseOperationsDashboardFilters } from "@/lib/registrations/operations-dashboard";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";
import { createHash } from "node:crypto";
const id=(n:number)=>{const h=createHash('md5').update(String(n)).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
export default async function Fixture() {
 const auth=await getCurrentAuthContext(await createSupabaseServerClient());
 const eventId=id(1);
 const row:OperationsParticipantRow={registrationId:id(99501),participantId:id(99502),eventId,eventTitle:'Evento sintetico',authUserId:null,
  firstName:'Ada',lastName:'Mori',name:'Ada Mori',publicCode:'MP01',birthDate:null,country:'Italia',city:'Roma',place:'Roma',email:null,phone:null,
  registrationStatus:'confirmed',submittedAt:null,currentGroupId:null,currentGroupName:null,currentGroupStatus:null,currentServiceId:null,currentServiceStatus:null,service:null,tagIds:[],tags:[],childrenCount:0,children:[]};
 const canManage=auth?.eventRoles.some(role=>role.role==='admin'&&role.eventId===null||role.role==='manager'&&role.eventId===eventId);
 return <main className="p-4"><EventAttendanceProvider eventId={eventId}><OperationsParticipantsTable
  snapshot={{participants:[row],allParticipants:[row],groupOptions:[],eventServices:[],operationalTags:[],filters:parseOperationsDashboardFilters({})}}
  selectedParticipant={null} attendancePanel={<></>} editableEventIds={canManage?[eventId]:[]} dashboard="manager" navMode="mini" canDeleteRegistration={false}
  operatorId={auth?.user.id??'anonymous'} eventId={eventId} eventStartsOn="2026-10-25" eventEndsOn="2026-10-27" /></EventAttendanceProvider></main>;
}
