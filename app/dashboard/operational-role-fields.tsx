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
                {groupOptions.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-start gap-2 rounded border border-transparent p-2 text-sm font-normal transition hover:border-[var(--peace-border)] hover:bg-[#f7fbfe]"
                  >
                    <input
                      name="groupIds"
                      type="checkbox"
                      value={group.id}
                      defaultChecked={selectedGroupIds.includes(group.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-[var(--peace-ink)]">{group.name}</span>
                      <span className="block text-xs text-[var(--peace-muted)]">
                        {group.eventTitle}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <GroupLeaderKindField defaultValue={defaultLeaderKind ?? undefined} />
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
