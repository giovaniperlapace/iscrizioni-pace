"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LeaderParticipantAttendance } from "@/app/dashboard/capogruppo/participant-attendance";
import { normalizeLocale } from "@/lib/i18n/config";
import { parseLeaderAttendance } from "@/lib/groups/leader-attendance";
export default function Fixture() {
  const locale = normalizeLocale(useSearchParams().get("locale")) ?? "it";
  const [result, setResult] = useState("");
  return <main className="mx-auto grid max-w-3xl gap-4 p-5">
    <h1>Partecipante sintetico</h1>
    <LeaderParticipantAttendance assignmentId="synthetic" returnTo="/dashboard/capogruppo?q=Anna"
      attendance={{startsOn:"2026-10-25",endsOn:"2026-10-27",unknown:false,slots:["2026-10-25__morning"]}}
      locale={locale} copy={{ title:"Giorni di presenza",help:"Seleziona i giorni di presenza.",unknown:"Da confermare",noDates:"Date non disponibili" }}
      action={async form => {
        const value = parseLeaderAttendance(form,"2026-10-25","2026-10-27");
        if (!value) return { status:"error", issues:[{field:"availabilitySlots",code:"attendance"}] };
        setResult(JSON.stringify({value, returnTo:form.get("returnTo")}));
      }} />
    <output data-result className="break-all">{result}</output>
  </main>;
}
