import { EmailCampaignComposer } from "@/app/dashboard/manager/email/email-campaign-composer";
import { PanelPublicationTable } from "@/app/dashboard/panel-publication-table";
import type { PanelDraftRow } from "@/lib/panels/panel-drafts";
const panel: PanelDraftRow = {
 id: "11111111-1111-4111-8111-111111111111", eventId: "11111111-1111-4111-8111-111111111100",
 title: "Dialogo sintetico", description: null, startsAt: "2026-10-25T09:00:00Z", endsAt: "2026-10-25T10:00:00Z",
 locationId: "room", locationName: "Sala sintetica", locationCapacity: 120, publicationStatus: "published",
 publishedAt: "2026-10-09T08:00:00Z", updatedAt: null, confirmedRegistrationCount: 35, assignedCapacity: 100,
 sections: [
  {id: "individual", audienceTypeId: "individual", audienceName: "Iscritti", bookingChannel: "individual", capacity: 70, occupied: 40},
  {id: "school", audienceTypeId: "school", audienceName: "Scuole", bookingChannel: "school_booking", capacity: 30, occupied: 18},
 ],
};
export default async function Fixture({searchParams}: {searchParams: Promise<{role?: string; view?: string}>}) {
 const {role,view}=await searchParams;
 if (view === "email") return <main className="mx-auto min-w-0 w-full max-w-6xl p-5"><EmailCampaignComposer allowPanelManagement={role === "admin"} panels={role === "admin" ? [{id:"panel",label:"Dialogo sintetico"}] : []} groups={[]} tags={[]} services={[]} initialRecipients={[]} templates={[]} campaigns={[]} /></main>;
 return <main className="mx-auto min-w-0 w-full max-w-6xl p-5"><h1>Catalogo gestionale sintetico</h1><PanelPublicationTable
 panels={[panel,{...panel,id:"11111111-1111-4111-8111-111111111112",title:"Bozza sintetica",publicationStatus:"draft"}]}
 totalCount={2} dashboard="admin" navMode="mini" eventId={panel.eventId} panelPath="/release-panel-check?role=manager" canManage={role!=="viewer"}
 /></main>;
}
