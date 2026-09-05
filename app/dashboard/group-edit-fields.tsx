"use client";

import { useState } from "react";
import { SearchableSelectField } from "@/app/dashboard/searchable-select-field";

export type GroupEditTreeRow = {
  id: string;
  eventId: string;
  name: string;
  parentGroupId: string | null;
  nodeType: string | null;
  isAssignable?: boolean | null;
};

export type GroupEditLeaderRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  eventId: string | null;
};

type GroupPlacementFieldsProps = {
  group: GroupEditTreeRow | null;
  groups: GroupEditTreeRow[];
  eventId: string;
};

type GroupPrimaryLeaderFieldsProps = {
  group: { primaryLeaderName: string | null } | null;
  leaders: GroupEditLeaderRow[];
};

const NEW_LEADER_VALUE = "__new__";

export function GroupPlacementFields({
  group,
  groups,
  eventId,
}: GroupPlacementFieldsProps) {
  const [nodeType, setNodeType] = useState(group?.nodeType ?? "group");
  const [assignable, setAssignable] = useState(group?.nodeType === "group" ? true : group?.isAssignable ?? true);
  const excluded = new Set(group ? [group.id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of groups) {
      if (row.parentGroupId && excluded.has(row.parentGroupId) && !excluded.has(row.id)) {
        excluded.add(row.id);
        changed = true;
      }
    }
  }
  const parents = groups.filter((row) => row.eventId === eventId && !excluded.has(row.id));
  const allowedParents = parents.filter((row) =>
    nodeType === "city" ? row.nodeType === "country" :
    nodeType === "area" ? row.nodeType === "city" : true
  );
  const names = new Map(parents.map((row) => [row.id, row.name]));
  const options = allowedParents.map((row) => ({
    label: `${row.parentGroupId && names.has(row.parentGroupId) ? `${names.get(row.parentGroupId)} / ` : ""}${row.name}`,
    value: row.id,
  }));

  return (
    <>
      <input type="hidden" name="eventId" value={eventId} />
      <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
        Tipo
        <select name="groupNodeType" className="field" value={nodeType} onChange={(event) => {
          setNodeType(event.target.value);
          setAssignable(event.target.value === "group");
        }}>
          <option value="group">Gruppo effettivo</option>
          <option value="country">Nodo territoriale: paese</option>
          <option value="city">Nodo territoriale: città</option>
          <option value="area">Nodo territoriale: area</option>
          {group?.nodeType === "newcomers" ? <option value="newcomers">Nodo nuovi partecipanti (storico)</option> : null}
        </select>
      </label>
      {nodeType !== "country" ? (
        <SearchableSelectField
          key={nodeType}
          label="Appartiene a"
          name="parentGroupId"
          options={options}
          placeholder={nodeType === "group" ? "Nessun nodo superiore (facoltativo)" : "Seleziona il territorio"}
          required={nodeType === "city" || nodeType === "area"}
          value={allowedParents.some((row) => row.id === group?.parentGroupId) ? group?.parentGroupId ?? "" : ""}
        />
      ) : <input type="hidden" name="parentGroupId" value="" />}
      <div className="grid gap-2 sm:col-span-2">
        <input type="hidden" name="isAssignable" value={assignable ? "on" : "off"} />
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={assignable} disabled={nodeType === "group"} onChange={(event) => setAssignable(event.target.checked)} />
          {nodeType === "group" ? "Gruppo iscrivibile e assegnabile" : "Questo nodo è anche un gruppo iscrivibile e assegnabile"}
        </label>
        <p className="text-sm text-[var(--peace-muted)]">
          {assignable ? "Il link di iscrizione viene creato automaticamente. Puoi modificarlo da Gestisci link." : "Serve a organizzare l’albero: non riceve iscrizioni né un link."}
        </p>
      </div>
    </>
  );
}

export function GroupPrimaryLeaderFields({
  group,
  leaders,
}: GroupPrimaryLeaderFieldsProps) {
  const leaderOptions = deduplicateLeaders(leaders);
  const matchedCurrentLeader = leaderOptions.find(
    (leader) =>
      group?.primaryLeaderName &&
      (leader.fullName === group.primaryLeaderName ||
        leader.email === group.primaryLeaderName)
  );

  return (
    <div className="grid gap-4 sm:col-span-2">
      <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
        Referente principale
        <select
          name="primaryLeaderUserId"
          defaultValue={matchedCurrentLeader?.userId ?? ""}
          className="field"
        >
          <option value="">Seleziona un capogruppo</option>
          {leaderOptions.map((leader) => (
            <option key={leader.userId} value={leader.userId}>
              {formatLeaderLabel(leader)}
            </option>
          ))}
          <option value={NEW_LEADER_VALUE}>Aggiungi nuovo referente</option>
        </select>
      </label>
      <div className="grid gap-4 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4 sm:grid-cols-2">
        <p className="text-sm font-semibold text-[var(--peace-ink)] sm:col-span-2">
          Se il referente non è nella lista, seleziona “Aggiungi nuovo referente”
          e compila questi campi.
        </p>
        <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
          Nome referente
          <input name="leaderFirstName" className="field bg-white" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)]">
          Cognome referente
          <input name="leaderLastName" className="field bg-white" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)] sm:col-span-2">
          Email referente
          <input name="leaderEmail" type="email" className="field bg-white" />
        </label>
      </div>
    </div>
  );
}

export function GroupAgeBandFields({
  ageBands,
}: {
  ageBands: string[] | null | undefined;
}) {
  const selectedBands = new Set(ageBands ?? []);

  return (
    <fieldset className="grid gap-3 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4 sm:col-span-2">
      <legend className="px-1 text-sm font-semibold text-[var(--peace-ink)]">
        Fasce di età
      </legend>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">
        Seleziona una o più fasce per proporre il gruppo soltanto alle persone
        di quelle età. Se non selezioni nulla, il gruppo non avrà alcun filtro
        di età.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { value: "giovani", label: "Giovani" },
          { value: "adulti", label: "Adulti" },
          { value: "anziani", label: "Anziani (oltre 65 anni)" },
        ].map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-3 rounded-md border border-[var(--peace-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--peace-ink)]"
          >
            <input
              type="checkbox"
              name="ageBands"
              value={option.value}
              defaultChecked={selectedBands.has(option.value)}
              className="size-4 accent-[var(--peace-blue-800)]"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function deduplicateLeaders(leaders: GroupEditLeaderRow[]) {
  const byUserId = new Map<string, GroupEditLeaderRow>();

  leaders
    .filter((leader) => leader.role === "capogruppo")
    .forEach((leader) => {
      if (!byUserId.has(leader.userId)) {
        byUserId.set(leader.userId, leader);
      }
    });

  return Array.from(byUserId.values()).sort((a, b) =>
    formatLeaderLabel(a).localeCompare(formatLeaderLabel(b))
  );
}

function formatLeaderLabel(leader: GroupEditLeaderRow) {
  const name = leader.fullName || leader.email || "Capogruppo";
  return leader.email && leader.fullName ? `${name} (${leader.email})` : name;
}
