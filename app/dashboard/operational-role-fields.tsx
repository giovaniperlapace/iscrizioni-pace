"use client";

import { useState } from "react";

import { GroupLeaderKindField } from "@/app/dashboard/group-leader-kind-field";

type RoleOption = {
  value: string;
  label: string;
};

type EventOption = {
  id: string;
  title: string;
};

type GroupOption = {
  id: string;
  name: string;
  eventTitle: string;
};

type OperationalRoleFieldsProps = {
  eventOptions: EventOption[];
  groupOptions: GroupOption[];
  roleOptions: RoleOption[];
  defaultRole?: string | null;
  defaultEventId?: string | null;
  defaultGroupId?: string | null;
  defaultGroupIds?: string[];
  defaultLeaderKind?: "primary" | "secondary" | null;
  defaultLeaderKindsByGroupId?: Record<string, "primary" | "secondary">;
  allowMultipleGroupLeaders?: boolean;
  showInviteOption?: boolean;
};

const EVENT_SCOPED_ROLES = new Set(["manager", "manager_viewer", "accoglienza"]);

export function OperationalRoleFields({
  eventOptions,
  groupOptions,
  roleOptions,
  defaultRole: defaultRoleProp,
  defaultEventId,
  defaultGroupId,
  defaultGroupIds,
  defaultLeaderKind,
  defaultLeaderKindsByGroupId = {},
  allowMultipleGroupLeaders = false,
  showInviteOption = false,
}: OperationalRoleFieldsProps) {
  const defaultRole =
    defaultRoleProp && roleOptions.some((option) => option.value === defaultRoleProp)
      ? defaultRoleProp
      : (roleOptions[0]?.value ?? "");
  const [role, setRole] = useState(defaultRole);
  const isGroupLeader = role === "capogruppo";
  const isEventScopedRole = EVENT_SCOPED_ROLES.has(role);
  const selectedGroupIds =
    defaultGroupIds && defaultGroupIds.length > 0
      ? defaultGroupIds
      : defaultGroupId
        ? [defaultGroupId]
        : [];
  const [selectedGroupIdSet, setSelectedGroupIdSet] = useState(
    () => new Set(selectedGroupIds)
  );
  const [leaderKindsByGroupId, setLeaderKindsByGroupId] = useState<
    Record<string, "primary" | "secondary">
  >(() =>
    Object.fromEntries(
      groupOptions.map((group) => [
        group.id,
        defaultLeaderKindsByGroupId[group.id] ??
          (selectedGroupIds.includes(group.id)
            ? defaultLeaderKind ?? "secondary"
            : "secondary"),
      ])
    )
  );

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
          Ruolo
          <select
            name="role"
            className="field bg-white font-normal"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            required
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {isEventScopedRole ? (
          <input
            type="hidden"
            name="eventId"
            value={defaultEventId ?? eventOptions[0]?.id ?? ""}
          />
        ) : null}
        {isGroupLeader && allowMultipleGroupLeaders ? (
          <>
            <fieldset className="grid gap-2 text-sm font-semibold text-[var(--peace-ink)] lg:col-span-2">
              <legend>Gruppi da seguire</legend>
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-[var(--peace-border-strong)] bg-white p-3">
                {groupOptions.map((group) => {
                  const isSelected = selectedGroupIdSet.has(group.id);
                  const leaderKind =
                    leaderKindsByGroupId[group.id] ?? "secondary";

                  return (
                    <div
                      key={group.id}
                      className={`grid gap-3 rounded-md border p-3 text-sm font-normal transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                        isSelected
                          ? "border-[var(--peace-blue-800)] bg-[var(--peace-sky-100)]"
                          : "border-transparent hover:border-[var(--peace-border)] hover:bg-[#f7fbfe]"
                      }`}
                    >
                      <label className="flex min-w-0 items-start gap-2">
                        <input
                          name="groupIds"
                          type="checkbox"
                          value={group.id}
                          checked={isSelected}
                          className="mt-1"
                          onChange={(event) => {
                            const checked = event.target.checked;

                            setSelectedGroupIdSet((current) => {
                              const next = new Set(current);

                              if (checked) {
                                next.add(group.id);
                              } else {
                                next.delete(group.id);
                              }

                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0">
                          <span className="font-semibold text-[var(--peace-ink)]">
                            {group.name}
                          </span>
                          <span className="block text-xs text-[var(--peace-muted)]">
                            {group.eventTitle}
                          </span>
                        </span>
                      </label>
                      <fieldset
                        className={`grid gap-1 transition ${
                          isSelected ? "" : "opacity-45"
                        }`}
                      >
                        <legend className="sr-only">
                          Tipo di capogruppo per {group.name}
                        </legend>
                        <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--peace-border)] bg-white p-1">
                          <label className="flex min-h-9 items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition has-[:checked]:bg-[var(--peace-blue-800)] has-[:checked]:text-white">
                            <input
                              name={`leaderKindByGroup:${group.id}`}
                              type="radio"
                              value="primary"
                              checked={leaderKind === "primary"}
                              disabled={!isSelected}
                              onChange={() =>
                                setLeaderKindsByGroupId((current) => ({
                                  ...current,
                                  [group.id]: "primary",
                                }))
                              }
                            />
                            Principale
                          </label>
                          <label className="flex min-h-9 items-center justify-center gap-2 rounded px-3 text-xs font-semibold transition has-[:checked]:bg-[var(--peace-blue-800)] has-[:checked]:text-white">
                            <input
                              name={`leaderKindByGroup:${group.id}`}
                              type="radio"
                              value="secondary"
                              checked={leaderKind !== "primary"}
                              disabled={!isSelected}
                              onChange={() =>
                                setLeaderKindsByGroupId((current) => ({
                                  ...current,
                                  [group.id]: "secondary",
                                }))
                              }
                            />
                            Secondario
                          </label>
                        </div>
                      </fieldset>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </>
        ) : isGroupLeader ? (
          <>
            <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
              Gruppo per capogruppo
              <select
                name="groupId"
                className="field bg-white font-normal"
                defaultValue={defaultGroupId ?? ""}
                required
              >
                <option value="">Seleziona gruppo</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <GroupLeaderKindField defaultValue={defaultLeaderKind ?? undefined} />
          </>
        ) : null}
      </div>
      {showInviteOption ? (
        <label className="flex items-start gap-2 text-sm text-[var(--peace-ink)]">
          <input name="sendInvite" type="checkbox" className="mt-1" defaultChecked />
          <span>
            {isGroupLeader
              ? "Invia subito un magic link con invito a completare l'iscrizione personale."
              : "Invia subito un magic link per accedere alla dashboard operativa."}
          </span>
        </label>
      ) : null}
    </div>
  );
}
