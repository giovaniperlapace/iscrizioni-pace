"use client";
import { useState } from "react";
import { GroupReceptionQr } from "@/app/dashboard/capogruppo/qr-gruppo/group-qr";
import type { SupportedLocale } from "@/lib/i18n/config";
const groups = [{ id: "00000000-0000-4000-8000-000000000001", name: "Anziani - Torrenova" }, { id: "00000000-0000-4000-8000-000000000002", name: "Група Київ / École" }];
export default function Fixture({ images }: { images: string[] }) {
 const [locale, setLocale] = useState<SupportedLocale>("it");
 const [scenario, setScenario] = useState("active");
 const [admin, setAdmin] = useState(false);
 const [calls, setCalls] = useState<{id: string; action: string}[]>([]);
 return <main className="mx-auto max-w-4xl p-5">
  <label>Lingua<select aria-label="Lingua" value={locale} onChange={e => setLocale(e.target.value as SupportedLocale)}>{["it","en","fr","de","es","nl","uk"].map(l => <option key={l}>{l}</option>)}</select></label>
  <label>Scenario<select aria-label="Scenario" value={scenario} onChange={e => setScenario(e.target.value)}>{["active","unavailable","revoked","slow"].map(s => <option key={s}>{s}</option>)}</select></label>
  <label><input type="checkbox" checked={admin} onChange={e => setAdmin(e.target.checked)} />Admin</label>
  <div className="mt-4 grid gap-3">{groups.map((group, i) => <article key={group.id} className="rounded-md border border-[var(--peace-border)] bg-[#f7fbfe] p-4">
   <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><h3 className="font-semibold">{group.name}</h3><div className="flex flex-wrap gap-2">
    <button className="min-h-9 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold">Gestisci link</button>
    <GroupReceptionQr groupId={group.id} groupName={group.name} locale={locale} canManage={admin} commandAction={async (id, action) => {
     setCalls(previous => [...previous, {id, action}]); await new Promise(resolve => setTimeout(resolve, scenario === "slow" ? 900 : 100));
     if (scenario === "unavailable") throw new Error("synthetic failure");
     if (scenario === "revoked" || action === "revoke") return {status:"revoked"};
     return {status:"active", image:images[i]};
    }} />
    <button className="min-h-9 rounded-md bg-[var(--peace-blue-800)] px-3 py-2 text-sm font-semibold text-white">Aggiungi partecipante</button>
   </div></div>
  </article>)}</div><pre data-calls className="hidden">{JSON.stringify(calls)}</pre>
 </main>;
}
