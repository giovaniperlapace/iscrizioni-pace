import { StatisticsSection } from "@/app/dashboard/statistics-section";
import { buildEventStatisticsSnapshot } from "@/lib/registrations/event-statistics";
const groups = [
  {id:"it",name:"Italia",nodeType:"country",parentGroupId:null},
  {id:"roma",name:"Roma",nodeType:"city",parentGroupId:"it"},
  {id:"centro",name:"Centro",nodeType:"area",parentGroupId:"roma"},
  {id:"trastevere",name:"Trastevere",nodeType:"group",parentGroupId:"centro"},
].map(g => ({...g,eventId:"event",isAssignable:true}));
const statistics = buildEventStatisticsSnapshot({groups,participants:["roma","trastevere"].map((id,i)=>({registrationId:`r${i}`,eventId:"event",eventTitle:"Evento",currentGroupId:id,currentGroupName:id,country:"Francia",city:"Parigi",childrenCount:i?2:0})),attendanceChoices:[{registration_id:"r1",day:"2026-10-25",day_part:"morning",choice:"yes"}],eventStartsOn:"2026-10-25",eventEndsOn:"2026-10-27"});
export default async function Fixture({searchParams}:{searchParams:Promise<{dashboard?:string}>}) {
  const {dashboard}=await searchParams;
  return <main className="mx-auto min-w-0 max-w-6xl p-4"><StatisticsSection statistics={statistics} dashboard={dashboard==="admin"?"admin":"manager"} navMode="full" /></main>;
}
