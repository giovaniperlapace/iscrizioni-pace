"use client";
import { ReliableForm } from "@/components/reliable-form";
import { useState } from "react";
import { GroupPlacementFields } from "@/app/dashboard/group-edit-fields";
import { CopyLinkButton } from "@/app/dashboard/group-link-copy-tools";
const groups = [
  { id: "country", eventId: "test", name: "Italia", nodeType: "country", parentGroupId: null, isAssignable: false },
  { id: "city", eventId: "test", name: "Roma", nodeType: "city", parentGroupId: "country", isAssignable: false },
  { id: "group", eventId: "test", name: "Gruppo esistente", nodeType: "group", parentGroupId: "city", isAssignable: true },
  { id: "child", eventId: "test", name: "Discendente", nodeType: "group", parentGroupId: "group", isAssignable: true },
];
export default function Fixture() {
  const [edit, setEdit] = useState(false);
  return <main className="mx-auto max-w-2xl p-5">
    <h1 className="mb-5 text-2xl font-semibold">{edit ? "Modifica gruppo" : "Nuovo gruppo"}</h1>
    <button className="mb-5 border p-2" onClick={() => setEdit(!edit)}>Cambia modalità</button>
    <ReliableForm className="grid gap-4 sm:grid-cols-2" action={async () => undefined}>
      <GroupPlacementFields key={String(edit)} group={edit ? groups[2] : null} groups={groups} eventId="test" />
      <label className="grid gap-2 sm:col-span-2">Nome gruppo<input name="name" className="field" required /></label>
      <button className="rounded bg-blue-900 p-3 text-white" type="submit">Salva gruppo</button>
    </ReliableForm>
    <div className="mt-8"><CopyLinkButton url="https://example.org/gruppo_test" /></div>
  </main>;
}
