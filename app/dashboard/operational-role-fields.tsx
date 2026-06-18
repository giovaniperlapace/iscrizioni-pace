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
};

const EVENT_SCOPED_ROLES = new Set(["manager", "manager_viewer", "accoglienza"]);

export function OperationalRoleFields({
  eventOptions,
  groupOptions,
  roleOptions,
}: OperationalRoleFieldsProps) {
  const defaultRole = roleOptions[0]?.value ?? "";
  const [role, setRole] = useState(defaultRole);
  const isGroupLeader = role === "capogruppo";
  const isEventScopedRole = EVENT_SCOPED_ROLES.has(role);

  return (
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
        <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
          Evento per ruoli evento
          <select
            name="eventId"
            className="field bg-white font-normal"
            defaultValue={eventOptions[0]?.id ?? ""}
            required
          >
            <option value="">Seleziona evento</option>
            {eventOptions.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isGroupLeader ? (
        <>
          <label className="grid gap-1 text-sm font-semibold text-[var(--peace-ink)]">
            Gruppo per capogruppo
            <select name="groupId" className="field bg-white font-normal" defaultValue="" required>
              <option value="">Seleziona gruppo</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} - {group.eventTitle}
                </option>
              ))}
            </select>
          </label>
          <GroupLeaderKindField />
        </>
      ) : null}
    </div>
  );
}
