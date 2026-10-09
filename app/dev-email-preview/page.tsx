import { notFound } from "next/navigation";

import { EmailCampaignComposer } from "@/app/dashboard/manager/email/email-campaign-composer";

export default function DevEmailPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="app-page p-6">
      <EmailCampaignComposer
        groups={[
          { id: "group-roma", label: "Roma" },
          { id: "group-assisi", label: "Assisi" },
        ]}
        tags={[{ id: "tag-1", label: "Volontari" }]}
        services={[{ id: "service-1", label: "Accoglienza" }]}
        panels={[{ id: "panel-1", label: "La pace disarmata" }]}
        initialRecipients={[
          {
            recipientKey: "participant:1",
            recipientType: "participant",
            fullName: "Ada Rossi",
            destinationEmail: "ada@example.org",
            deliveryKind: "direct",
            selected: false,
            groupIds: ["group-roma"],
            tagIds: ["tag-1"],
            serviceIds: [],
            panelIds: ["panel-1"],
            schoolNames: [],
          },
          {
            recipientKey: "participant:2",
            recipientType: "participant",
            fullName: "Bruno Verdi",
            destinationEmail: "bruno@example.org",
            deliveryKind: "direct",
            selected: false,
            groupIds: [],
            tagIds: [],
            serviceIds: ["service-1"],
            panelIds: [],
            schoolNames: [],
          },
          {
            recipientKey: "participant:3",
            recipientType: "participant",
            fullName: "Carla Bianchi",
            destinationEmail: "referente@example.org",
            deliveryKind: "delegated",
            selected: false,
            groupIds: ["group-assisi"],
            tagIds: [],
            serviceIds: [],
            panelIds: [],
            schoolNames: [],
          },
          {
            recipientKey: "leader:1",
            recipientType: "group_leader",
            fullName: "Diego Capogruppo",
            destinationEmail: "diego@example.org",
            deliveryKind: "leader",
            selected: false,
            groupIds: ["group-roma", "group-assisi"],
            tagIds: [],
            serviceIds: [],
            panelIds: [],
            schoolNames: [],
          },
          {
            recipientKey: "leader:2",
            recipientType: "group_leader",
            fullName: "Elena Referente",
            destinationEmail: "elena@example.org",
            deliveryKind: "leader",
            selected: false,
            groupIds: ["group-assisi"],
            tagIds: [],
            serviceIds: [],
            panelIds: [],
            schoolNames: [],
          },
          {
            recipientKey: "teacher:1",
            recipientType: "teacher",
            fullName: "Franca Docente",
            destinationEmail: "franca@example.org",
            deliveryKind: "teacher",
            selected: false,
            groupIds: [],
            tagIds: [],
            serviceIds: [],
            panelIds: ["panel-1"],
            schoolNames: ["Liceo della Pace"],
          },
        ]}
        templates={[]}
        campaigns={[]}
      />
    </main>
  );
}
