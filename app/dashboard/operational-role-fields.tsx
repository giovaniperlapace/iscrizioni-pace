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
  defaultLeaderKind?: "primary" | "secondary" | null;
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
  defaultLeaderKind,
  showInviteOption = false,
}: OperationalRoleFieldsProps) {
  const defaultRole =
    defaultRoleProp && roleOptions.some((option) => option.value === defaultRoleProp)
      ? defaultRoleProp
      : (roleOptions[0]?.value ?? "");
  const [role, setRole] = useState(defaultRole);
  const isGroupLeader = role === "capogruppo";
  const isEventScopedRole = EVENT_SCOPED_ROLES.has(role);

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
        {isGroupLeader ? (
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
