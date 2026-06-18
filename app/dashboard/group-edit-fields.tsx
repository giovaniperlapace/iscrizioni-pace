import { SearchableSelectField } from "@/app/dashboard/searchable-select-field";

export type GroupEditTreeRow = {
  id: string;
  eventId: string;
  name: string;
  parentGroupId: string | null;
  nodeType: string | null;
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
  const countryGroups = groups
    .filter(
      (candidate) =>
        candidate.eventId === eventId &&
        candidate.id !== group?.id &&
        candidate.nodeType === "country"
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityGroups = groups
    .filter(
      (candidate) =>
        candidate.eventId === eventId &&
        candidate.id !== group?.id &&
        candidate.nodeType === "city"
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const countryNameById = new Map(
    countryGroups.map((candidate) => [candidate.id, candidate.name])
  );
  const currentPlacement =
    group && isSupportedPlacement(group.nodeType)
      ? placementValue(group.nodeType, group.parentGroupId)
      : "";
  const placementOptions = [
    {
      groupLabel: "Paesi",
      label: "Crea un nuovo paese",
      value: "country:",
    },
    ...countryGroups.map((country) => ({
      groupLabel: "Città",
      label: `Crea una nuova città in ${country.name}`,
      value: placementValue("city", country.id),
    })),
    ...cityGroups.map((city) => {
      const countryName = city.parentGroupId
        ? countryNameById.get(city.parentGroupId)
        : null;

      return {
        groupLabel: "Aree",
        label: `Crea una nuova area in ${countryName ? `${countryName} / ` : ""}${city.name}`,
        value: placementValue("area", city.id),
      };
    }),
  ];

  return (
    <>
      <input type="hidden" name="eventId" value={eventId} />
      <SearchableSelectField
        label="Posizione del gruppo: a quale paese o città appartiene"
        name="groupPlacement"
        options={placementOptions}
        placeholder="Cerca paese o città"
        required
        value={currentPlacement}
      />
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

function isSupportedPlacement(
  nodeType: string | null
): nodeType is "country" | "city" | "area" {
  return nodeType === "country" || nodeType === "city" || nodeType === "area";
}

function placementValue(nodeType: string | null, parentGroupId: string | null) {
  return `${nodeType ?? "country"}:${parentGroupId ?? ""}`;
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
